require("dotenv").config();
const xlsx = require('node-xlsx').default;
const mysql = require("mysql2/promise");
const format = require("@stdlib/string-format");
const common = require("./common");

const connection_config = {
  host     : process.env.MDL_DATABASE_HOST,
  port     : process.env.MDL_DATABASE_PORT,
  user     : process.env.MDL_DATABASE_USER,
  password : process.env.MDL_DATABASE_PASSWORD,
  database : process.env.MDL_DATABASE_NAME,
  connectionLimit: 10,
};

const file_name = "students_FX";
const students_data = xlsx.parse(`${__dirname}/${file_name}.xlsx`);

let student_names_set = new Set();
let student_subj_data = [];

for (const rows of students_data[0].data) {
  if (!rows[1]) continue;
  if (rows[1] === "") continue;
  if (rows[1] === "ФИО студента") continue;

  //console.log(rows[1]);
  student_names_set.add(rows[1].trim());
  student_subj_data.push({
    s_name: rows[1].trim(),
    subj: rows[2].trim().toLowerCase()
  });
}

//console.log(student_subj_data);
const changing_data = {
  vsk1: "2023.03.28 23:55:00",
  //vsk2: "2023.05.10 23:55:00",
  //exam: "2023.05.22 23:55:00",
};

(async () => {
  const pool = mysql.createPool(connection_config);

  let counter = 0;
  let q_counter = 0;
  for (let data of student_subj_data) {
    const [ first_name, last_name ] = data.s_name.split(" ");
    let student_data = await common.get_user_by_name(pool, first_name, last_name);
    if (student_data.length == 0) student_data = await common.get_user_by_name(pool, last_name, first_name);
    if (student_data.length == 0) {
      console.log(`Could not find student with name ${data.s_name}`);
      continue;
    }

    if (student_data.length > 1) {
      console.log(`Found 2 students with name ${data.s_name}`);
      continue;
    }

    const user_id = student_data[0].id;
    const courses = await common.get_courses(pool, user_id);
    const cur = counter;
    let course_id = undefined;
    let course_name = "";
    for (const course of courses) {
      const final_name = course.fullname.trim().toLowerCase();
      if (final_name == data.subj) {
        //console.log(`Found course ${data.subj}`);
        ++counter;
        course_id = course.id;
        course_name = course.fullname;
        break;
      }
    }

    if (counter == cur) {
      console.log(`Could not find course ${data.subj} for student ${data.s_name}`);
      continue;
    }

    for (const [ qtype, new_date ] of Object.entries(changing_data)) {
      const quizes = await common.get_raw_quizes(pool, course_id, qtype); // получаем список тестов по типу
      const new_time = common.make_unix_timestamp(new_date);
      if (quizes.length == 0) {
        // возможно не задан тип теста, что тогда? нужно именно госэкз найти
        console.log(`Could not find tests in course ${course_name} (${course_id})`);
        continue;
      }

      for (const quiz of quizes) {
        //console.log(`Test '${quiz.name}' prolongation for course '${course_name}' to time ${new_date}`);
        await common.update_quiz_close_time(pool, quiz.id, new_time); // обновляем время окончания теста по unix timestamp
        ++q_counter;

        let attempts = await common.get_quiz_attempts(pool, quiz.id, user_id);
        if (attempts.length == 0) {
          //console.log(`Could not find quiz ${course_name} attempts for ${data.s_name}`);
          continue;
        }

        //console.log(`${data.s_name}`);
        attempts.sort((a, b) => { return a.sumgrades > b.sumgrades; });
        //console.log(`${data.s_name} attempt ${attempts[0].sumgrades} ${attempts[0].id}`);
        //await common.delete_attempt_from_quiz(pool, attempts[0].id);
      }
    }

    //break;
  }

  console.log(`${student_subj_data.length} ${counter}`);
  console.log(`${q_counter} quizes prolongate`);

  await pool.end();
})();