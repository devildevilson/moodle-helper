require("dotenv").config();
const mysql = require("mysql2/promise");
const format = require("@stdlib/string-format");
const mdl_common = require("./common");
const plt_common = require("./plt_common");

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
};

const plt_connection_config = {
  host     : process.env.PLT_DATABASE_HOST,
  port     : process.env.PLT_DATABASE_PORT,
  user     : process.env.PLT_DATABASE_USER,
  password : process.env.PLT_DATABASE_PASSWORD,
  database : process.env.PLT_DATABASE_NAME,
  connectionLimit: 10,
  connectTimeout: 100000,
};

function parse_teacher_id(idnumber) {
  if (idnumber[0] !== 't') return undefined;
  const str = idnumber.substring(1);
  return parseInt(str);
}

function make_course_id_number(plt_teacher_id, plt_course_id, study_form, lang_id) {
  return `${plt_teacher_id}-${plt_course_id}-${study_form}-${lang_id}`;
}

function make_start_date() {
  const cur_date = new Date();
  const year = cur_date.getFullYear();
  const month = cur_date.getMonth();
  const august_month = 7;
  let start_date_str = `${year}.01.01 00:00:00`;
  if (month > august_month) {
    start_date_str = `${year}.09.01 00:00:00`;
  }

  return start_date_str;
}

function make_end_date() {
  const cur_date = new Date();
  const year = cur_date.getFullYear();
  const month = cur_date.getMonth();
  const august_month = 7;
  let date_str = `${year}.08.31 23:59:00`;
  if (month > august_month) {
    date_str = `${year}.12.31 23:59:00`;
  }

  return date_str;
}

function get_subject_name(sub, lang) {
  if (lang == 1) return sub.SubjectNameRU;
  else if (lang == 2) return sub.SubjectNameKZ;
  return sub.SubjectNameENG;
}

function get_subject_code(sub, lang) {
  return sub.SubjectCodeRu;
}

const current_tests_time = {
  vsk1: { name: "Рубежный контроль 1", open: "2023.03.13 00:00:00", close: "2023.03.17 23:55:00", attempts: 3, time: 40*60 },
  vsk2: { name: "Рубежный контроль 2", open: "2023.05.02 00:00:00", close: "2023.05.05 23:55:00", attempts: 3, time: 40*60 },
  exam: { name: "Экзамен",             open: "2023.05.08 00:00:00", close: "2023.05.27 23:55:00", attempts: 1, time: 50*60 },
};

(async () => {
  const mdl_pool = mysql.createPool(mdl_connection_config);
  const plt_conn = await mysql.createConnection(plt_connection_config);
  //const plt_pool = mysql.createPool(plt_connection_config);

  //let created_first = false;

  const teachers = await mdl_common.get_teachers(mdl_pool);
  for (const t of teachers) {
    if (t.id !== 3167) continue;
    console.log(`teacher: ${t.firstname} ${t.lastname} ${t.idnumber} ${t.id}`);

    {
      const courses = await mdl_common.get_courses(mdl_pool, t.id);
      const plt_id = parse_teacher_id(t.idnumber);
      const subjects = await plt_common.get_teacher_subjects(plt_conn, plt_id);
      
      // console.log(`subjects: `, subjects.length);
      // for (const sub of subjects) {
      //   console.log(`${sub.tutorid} ${sub.subjectid} ${sub.studyForm} ${sub.language}`);
      // }
      // return;

      let course_set = new Set();
      for (const course of courses) {
        course_set.add(course.idnumber);
      }

      for (const sub of subjects) {
        const idnumber = make_course_id_number(sub.TutorID, sub.SubjectID, sub.studyForm, sub.language);
        //console.log(`idnumber: ${idnumber}`);
        if (course_set.has(idnumber)) continue;

        const study_groups = await plt_common.get_study_groups(plt_conn, sub.TutorID, sub.SubjectID, sub.studyForm);
        //console.log(`study_groups.length: ${study_groups.length}`);
        if (study_groups.length === 0) continue;

        // если этот idnumber нет среди courses, то создадим курс в мудле
        // как? нужно добавить строку в mdl_course, добавить строку в mdl_enroll,
        // добавить препода в mdl_user_enrolments
        const plt_subject = await plt_common.get_subject(plt_conn, sub.SubjectID);
        const name = get_subject_name(plt_subject, sub.language);
        const subj_code = get_subject_code(plt_subject, sub.language);
        const shortname = `${subj_code}-${sub.studyForm}-${sub.language}-${sub.SubjectID}`;
        const startdate = mdl_common.make_unix_timestamp(make_start_date());

        console.log(`Creating ${name} ${shortname}`);

        const course_id = await mdl_common.create_course(mdl_pool, name, shortname, idnumber, startdate);
        //const course_id = await mdl_common.get_last_added_course_id(mdl_pool, idnumber);
        //await mdl_common.create_enrol(mdl_pool, course_id);
        //const enrol_id = await mdl_common.get_last_added_enrol_id(mdl_pool, course_id, "manual");
        const enrol_id = await mdl_common.create_enrol_and_get(mdl_pool, course_id, "manual");
        await mdl_common.enrol_user(mdl_pool, enrol_id, t.id);
        const ctx_id = await mdl_common.create_context(mdl_pool, course_id);
        await mdl_common.assign_role(mdl_pool, t.id, ctx_id, 3); // 3 - учитель

        // курс создан, по идее теперь нужно взять текущий курс и создать дефолтные модули 
        // (только форум? да и нужен ли он?)
        // до этого нужно создать секциии наверное

        // 9 секций [0,8]
        for (let i = 0; i < 9; ++i) {
          await mdl_common.create_section(mdl_pool, course_id, i, undefined);
        }

        await mdl_common.create_default_blocks(mdl_pool, ctx_id);

        course_set.add(idnumber);
        console.log(`Created  ${name} ${shortname} ${course_id}`);

        //created_first = true;
        //if (created_first) throw "Create one";
      }
      //break;
    }

    // предположим что создали курсы которых нет
    // теперь бы к курсам добавить тесты без вопросов
    {
      const start_date = mdl_common.make_unix_timestamp(make_start_date());
      const end_date = mdl_common.make_unix_timestamp(make_end_date());
      const courses = await mdl_common.get_courses(mdl_pool, t.id);
      for (const course of courses) {
        // надо как то пройтись по курсам этого семестра, как? вообще скорее всего по времени начала
        // или может быть из платонуса брать данные?
        //if (course.startdate < start_date || course.startdate >= end_date) continue; 
        const numbers = course.idnumber.split('-');
        //if (course.id !== 7411) continue;

        console.log(`${course.id} ${course.fullname} ${course.idnumber}`);

        if (numbers[2] === ".") continue;
        const study_groups = await plt_common.get_study_groups(plt_conn, numbers[0], numbers[1], numbers[2]);
        if (study_groups.length === 0) continue;

        //console.log(study_groups);

        // скорее всего если в этих курсах уже есть тесты, то трогать тогда курсы не нужно совсем
        // и разбираться с ними как то отдельно
        let quiz_f = undefined;
        for (const [ key, _ ] of Object.entries(current_tests_time)) {
          const found_quiz = await mdl_common.get_raw_quizes(mdl_pool, course.id, key);
          if (found_quiz.length > 0) {
            quiz_f = found_quiz[0];
            console.log(`Found quiz ${key} ${quiz_f.id}`);
            break;
          }
        }

        if (quiz_f) continue;

        console.log(`Creating tests for ${course.id} ${course.fullname} ${course.idnumber}`);

        for (const [ key, quiz_data ] of Object.entries(current_tests_time)) {
          const open = mdl_common.make_unix_timestamp(quiz_data.open);
          const close = mdl_common.make_unix_timestamp(quiz_data.close);
          const quiz_id = await mdl_common.create_test_for_course(mdl_pool, course.id, quiz_data.name, open, close, quiz_data.attempts, quiz_data.time, key);
          console.log(`Created quiz ${key}`, quiz_id);
        }
        
        // что теперь?
        // создали дополнительные курсы и создали тесты к ним
      }

      //break;
    }
  }

  console.log("Created");

  await mdl_pool.end();
  await plt_conn.end();
})();