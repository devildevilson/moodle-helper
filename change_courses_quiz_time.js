require("dotenv").config();
const mysql = require("mysql2/promise");
const format = require("@stdlib/string-format");
const mdl_common = require("./common");
const plt_common = require("./plt_common");
const xlsx = require("node-xlsx");
const fs = require("fs");

// создадим курсы в мудл из платонуса
// нужно просмотреть всех преподов в мудле, 
// взять оттуда информацию о преподе, просмотреть курсы в платонусе
// если в мудле нет курса, создать его и + добавить 3 теста с верными датами

const mdl_connection_config = {
  host     : process.env.MDL_DATABASE_HOST,
  port     : process.env.MDL_DATABASE_PORT,
  user     : process.env.MDL_DATABASE_USER,
  password : process.env.MDL_DATABASE_PASSWORD,
  database : process.env.MDL_DATABASE_NAME,
  connectionLimit: 10,
  connectTimeout: 1000000,
};

const plt_connection_config = {
  host     : process.env.PLT_DATABASE_HOST,
  port     : process.env.PLT_DATABASE_PORT,
  user     : process.env.PLT_DATABASE_USER,
  password : process.env.PLT_DATABASE_PASSWORD,
  database : process.env.PLT_DATABASE_NAME,
  connectionLimit: 10,
  connectTimeout: 1000000,
};

function get_year_term() {
  const current_date = new Date();
  const august_month = 7;
  if (current_date.getMonth() < august_month) { return { year: current_date.getFullYear()-1, term: 2 }; }
  return { year: current_date.getFullYear(), term: 1 };
}

function make_good_day_num(num) {
  return num < 10 ? "0"+num : ""+num;
}

function make_current_day_str() {
  const current_date = new Date();
  const month_str = make_good_day_num(current_date.getMonth()+1);
  const day_str = make_good_day_num(current_date.getDate());
  return `${current_date.getFullYear()}.${month_str}.${day_str}`;
}

function print_time(str, date) {
  const number = mdl_common.make_unix_timestamp(new Date(date));
  console.log(`${str} ${number}`);
}

const current_tests_time = {
  vsk1: { name: "Рубежный контроль 1", open: "2023.03.13 00:00:00", close: "2023.03.26 23:55:00", attempts: 3, time: 40*60 },
  vsk2: { name: "Рубежный контроль 2", open: "2023.05.02 00:00:00", close: "2023.05.07 23:55:00", attempts: 3, time: 40*60 },
  exam: { name: "Экзамен",             open: "2023.05.08 00:00:00", close: "2023.05.27 23:55:00", attempts: 1, time: 50*60 },
};

const id_to_study_form = {
  3:  "ДОТ на базе высшего",
  8:  "ДОТ 3г",
  19: "ДОТ 4г",
  20: "ДОТ заочное 3г",
  30: "ДОТ колледж 2г",
};

let xlsx_data = [
  [ "Преподаватель", "Дисциплина", "Код дисциплины", "Форма обучения", "Язык", "id академического потока", "id преподавателя в platonus" ],

];

let xlsx_data2 = [
  [ "Преподаватель", "Дисциплина", "Код дисциплины", "Форма обучения", "Язык", "id академического потока", "id преподавателя в platonus", "Тесты" ],

];

let xlsx_data3 = [
  [ "Преподаватель", "Дисциплина", "Код дисциплины", "Форма обучения", "Язык", "id академического потока", "id преподавателя в platonus", "id преподавателя в moodle", "Тесты" ],

];

(async () => {
  //print_time("open", current_tests_time.vsk1.open);
  
  const mdl_pool = mysql.createPool(mdl_connection_config);
  const plt_conn = await mysql.createConnection(plt_connection_config);

  const { year, term } = get_year_term();

  let course_counter = 0;
  let test_counter = 0;
  const study_groups = await plt_common.get_study_groups_by_year(plt_conn, year, term);
  console.log(`Found ${study_groups.length} study groups`);
  for (const group of study_groups) {
    const tutor = await plt_common.get_tutor(plt_conn, group.tutorid);

    const tutor_subject = await plt_common.get_tutor_subject(plt_conn, group.tutorSubjectID);
    const subject = await plt_common.get_subject(plt_conn, tutor_subject.SubjectID);

    const course_idnumber = `${group.tutorid}-${tutor_subject.SubjectID}-${tutor_subject.studyForm}-${tutor_subject.language}`;
    const course = await mdl_common.find_course_with_idnumber(mdl_pool, course_idnumber);
    if (!course) {
      console.log(`Could not find course with idnumber '${course_idnumber}'`);
      // надо бы наверное эксель составить с теми которых нет
      const study_form = id_to_study_form[tutor_subject.studyForm] ? id_to_study_form[tutor_subject.studyForm] : tutor_subject.studyForm+""
      const lang = tutor_subject.language === 1 ? "Рус" : (tutor_subject.language === 2 ? "Каз" : "Англ");
      const tutor_name = tutor ? `${tutor.lastname} ${tutor.firstname} ${tutor.patronymic}` : "Не задан";
      xlsx_data.push([
        tutor_name, subject.SubjectNameRU, subject.SubjectCodeRu, study_form, lang, group.StudyGroupID+"", group.tutorid+""
      ]);
      continue;
    }

    let test_with_bad_question_count = "";
    let local_test_counter = new Set(["vsk1", "vsk2", "exam"]);
    const tests = await mdl_common.get_course_tests(mdl_pool, course.id);
    for (const test of tests) {
      if (typeof test.plt_testtype !== "string") continue;
      if (test.plt_testtype !== "vsk1" && test.plt_testtype !== "vsk2" && test.plt_testtype !== "exam") continue;
      const current_time = current_tests_time[test.plt_testtype];
      if (!current_time) continue;

      //const questions_id = test.questions.split(","); //  || questions_id < 20
      if (typeof test.questions !== "string" || test.questions === "") test_with_bad_question_count += test.plt_testtype+",";

      const open_time = mdl_common.make_unix_timestamp(current_time.open);
      const close_time = mdl_common.make_unix_timestamp(current_time.close);

      //await mdl_common.update_quiz_time(mdl_pool, test.id, open_time, close_time);
      //console.log(`Update time in course ${course.id} ${course.fullname} for test ${test.id} ${test.plt_testtype}`);
      //local_test_counter += 1;
      local_test_counter.delete(test.plt_testtype);
    }

    const not_created_tests = Array.from(local_test_counter);
    if (not_created_tests.length !== 0) {
      console.log(`Tests are not created for course '${course_idnumber}'`);
      // надо бы наверное эксель составить с теми которых нет
      const study_form = id_to_study_form[tutor_subject.studyForm] ? id_to_study_form[tutor_subject.studyForm] : tutor_subject.studyForm+""
      const lang = tutor_subject.language === 1 ? "Рус" : (tutor_subject.language === 2 ? "Каз" : "Англ");
      const tutor_name = tutor ? `${tutor.lastname} ${tutor.firstname} ${tutor.patronymic}` : "Не задан";
      const tests_str = not_created_tests.join(",");
      xlsx_data2.push([
        tutor_name, subject.SubjectNameRU, subject.SubjectCodeRu, study_form, lang, group.StudyGroupID+"", group.tutorid+"", tests_str
      ]);
    }

    if (test_with_bad_question_count !== "") {
      const mdl_teacher = await mdl_common.get_teacher_by_plt_id(mdl_pool, group.tutorid);
      test_with_bad_question_count = test_with_bad_question_count.substring(0, test_with_bad_question_count.length-1);
      console.log(`Found tests with zero questions in course '${course_idnumber}'`);
      // надо бы наверное эксель составить с теми которых нет
      const study_form = id_to_study_form[tutor_subject.studyForm] ? id_to_study_form[tutor_subject.studyForm] : tutor_subject.studyForm+""
      const lang = tutor_subject.language === 1 ? "Рус" : (tutor_subject.language === 2 ? "Каз" : "Англ");
      const tutor_name = tutor ? `${tutor.lastname} ${tutor.firstname} ${tutor.patronymic}` : "Не задан";
      //console.log(mdl_teacher);
      xlsx_data3.push([
        tutor_name, subject.SubjectNameRU, subject.SubjectCodeRu, study_form, lang, group.StudyGroupID+"", group.tutorid+"", mdl_teacher.id+"", test_with_bad_question_count
      ]);
    }

    course_counter += (not_created_tests.length !== 3);
    test_counter += (3 - not_created_tests.length);
  }

  console.log(`Updated ${test_counter} tests in ${course_counter} courses`);

  await mdl_pool.end();
  await plt_conn.end();

  const date_str = make_current_day_str();

  {
    const buffer = xlsx.build([{name: 'Лист1', data: xlsx_data}]);
    console.log(`Writing ${xlsx_data.length} rows`);
    fs.writeFile(`courses_not_created_${date_str}.xlsx`, buffer, err => {
      if (err) { console.error(err); return; }
      console.log(`Success computing`);
    });
  }

  {
    const buffer = xlsx.build([{name: 'Лист1', data: xlsx_data2}]);
    console.log(`Writing ${xlsx_data2.length} rows`);
    fs.writeFile(`tests_not_created_${date_str}.xlsx`, buffer, err => {
      if (err) { console.error(err); return; }
      console.log(`Success computing`);
    });
  }

  {
    const buffer = xlsx.build([{name: 'Лист1', data: xlsx_data3}]);
    console.log(`Writing ${xlsx_data3.length} rows`);
    fs.writeFile(`tests_with_zero_questions_${date_str}.xlsx`, buffer, err => {
      if (err) { console.error(err); return; }
      console.log(`Success computing`); 
    });
  }
})();