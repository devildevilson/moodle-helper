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

// function print_time(str, date) {
//   const number = mdl_common.make_unix_timestamp(new Date(date));
//   console.log(`${str} ${number}`);
// }

// const current_tests_time = {
//   vsk1: { name: "Рубежный контроль 1", open: "2023.03.13 00:00:00", close: "2023.03.26 23:55:00", attempts: 3, time: 40*60 },
//   vsk2: { name: "Рубежный контроль 2", open: "2023.05.02 00:00:00", close: "2023.05.05 23:55:00", attempts: 3, time: 40*60 },
//   exam: { name: "Экзамен",             open: "2023.05.08 00:00:00", close: "2023.05.27 23:55:00", attempts: 1, time: 50*60 },
// };

// const id_to_study_form = {
//   3:  "ДОТ на базе высшего",
//   8:  "ДОТ 3г",
//   19: "ДОТ 4г",
//   20: "ДОТ заочное 3г",
//   30: "ДОТ колледж 2г",
// };


function add_zero(num) {
  return num < 10 ? "0"+num : ""+num;
}

function to_string(date) {
  const year = add_zero(date.getFullYear());
  const month = add_zero(date.getMonth()+1);
  const day = add_zero(date.getDate());
  const hour = add_zero(date.getHours());
  const min = add_zero(date.getMinutes());
  const sec = add_zero(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
}

// const test_type = process.argv[2];
// if (test_type !== "vsk1" && test_type !== "vsk2" && test_type !== "exam") {
//   console.log(`Could not parse test type ${test_type}`);
//   return;
// }

(async () => {
  const mdl_pool = mysql.createPool(mdl_connection_config);
  const plt_conn = await mysql.createConnection(plt_connection_config);

  const { year, term } = get_year_term();
  // 0 - летник, 1 - первый, 2 - второй
  for (let i = 0; i < 3; ++i) {
    const term1 = i;
    let xlsx_data = [
      [ "id студента", "id курса", "id теста", "Студент", "Дисциплина", "Курс", "Тип теста", "Время начала", "Время конца", "Поменять?", "Очистить тест?" ],

    ];

    const study_groups = await plt_common.get_study_groups_by_year(plt_conn, year, term1);
    console.log(`Found ${study_groups.length} study groups`);
    for (const group of study_groups) {
      if (group.tutorid === 0) continue;
      const course_idnumber = `${group.tutorid}-${group.SubjectID}-${group.studyForm}-${group.language}`;
      const course = await mdl_common.find_course_with_idnumber(mdl_pool, course_idnumber);
      if (!course) {
        console.log(`Could not find course with idnumber '${course_idnumber}'`);
        continue;
      }

      const students = await plt_common.get_students_by_group_id(plt_conn, group.StudyGroupID);

      let found_test = undefined;
      const tests = await mdl_common.get_course_tests(mdl_pool, course.id);
      for (const test of tests) {
        if (typeof test.plt_testtype !== "string") continue;
        if (test.plt_testtype !== "vsk1" && test.plt_testtype !== "vsk2" && test.plt_testtype !== "exam") continue;
        //if (test.plt_testtype !== test_type) continue;
        found_test = test;
        //break;
      

        for (const student of students) {
          const name = `${student.lastname} ${student.firstname} ${student.patronymic}`;
          const test_id = found_test ? found_test.id+"" : "Не найден";
          const start_time = found_test ? "t"+to_string(new Date(found_test.timeopen * 1000)) : "";
          const end_time = found_test ? "t"+to_string(new Date(found_test.timeclose * 1000)) : "";

          xlsx_data.push([
            "t"+student.StudentID, course.id+"", test_id+"", name, course.fullname, student.CourseNumber, test.plt_testtype, start_time, end_time, "", ""
          ]);
        }
      }
    }

    const date_str = make_current_day_str();

    {
      const buffer = xlsx.build([{name: 'Лист1', data: xlsx_data}]);
      console.log(`Writing ${xlsx_data.length} rows`);
      fs.writeFile(`prolongation_term${term1}_${date_str}.xlsx`, buffer, err => {
        if (err) { console.error(err); return; }
        console.log(`Success computing`);
      });
    }
  }

  

  await mdl_pool.end();
  await plt_conn.end();
})();