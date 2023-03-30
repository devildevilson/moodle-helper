require("dotenv").config();
const mysql = require("mysql2/promise");
const format = require("@stdlib/string-format");
const common = require("./common");
const plt = require("./plt_common");

const connection_config = {
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
  connectTimeout: 1000000,
};

function get_year_term() {
  const current_date = new Date();
  const august_month = 7;
  if (current_date.getMonth() < august_month) { return { year: current_date.getFullYear()-1, term: 2 }; }
  return { year: current_date.getFullYear(), term: 1 };
}

// возможно было бы неплохо эти данные получить из аргументов
const changing_data = {
  vsk1: "2023.03.30 23:55:00",
  //vsk2: "2023.01.10 23:55:00",
  //exam: "2023.01.11 23:55:00",
};

const user_id = 3597;

(async () => {
  const pool = await mysql.createPool(connection_config);
  const plt_conn = await mysql.createConnection(plt_connection_config);

  const { year, term } = get_year_term();

  // сначала нужно понять кто перед нами: препод или студент и получить с него список курсов, необязательно
  // затем в курсах нужно найти все тесты по типу

  // получаем список курсов (как получить список курсов второго семестра?)
  // обязательно ли лезть в платонус? скорее всего да
  const student_idnumber = await common.get_user_idnumber(pool, user_id);
  const plt_student_id = parseInt(student_idnumber.substring(1));
  if (isNaN(plt_student_id)) throw `Could not parse idnumber ${student_idnumber}`;
  const groups = await plt.get_study_groups_data_by_student_id(plt_conn, plt_student_id, year, term);
  for (const group of groups) {
    const course = await common.get_course_by_plt_data(pool, group.tutorid, group.SubjectID, group.studyForm, group.language);
    for (const [ qtype, new_date ] of Object.entries(changing_data)) {
      const quizes = await common.get_raw_quizes(pool, course.id, qtype); // получаем список тестов по типу
      const new_time = common.make_unix_timestamp(new_date);
      if (quizes.length == 0) {
        console.log(`Could not find tests in course ${course.fullname}`);
        continue;
      }

      for (const quiz of quizes) {
        console.log(`Test '${quiz.name}' prolongation for course '${course.fullname}' to time ${new_date}`);
        await common.update_quiz_close_time(pool, quiz.id, new_time); // обновляем время окончания теста по unix timestamp
      }
    }
  }

  // const courses = await common.get_courses(pool, user_id);
  // for (const course of courses) {
  //   for (const [ qtype, new_date ] of Object.entries(changing_data)) {
  //     const quizes = await common.get_raw_quizes(pool, course.id, qtype); // получаем список тестов по типу
  //     const new_time = common.make_unix_timestamp(new_date);
  //     if (quizes.length == 0) {
  //       console.log(`Could not find tests in course ${course.fullname}`);
  //       continue;
  //     }

  //     for (const quiz of quizes) {
  //       console.log(`Test '${quiz.name}' prolongation for course '${course.fullname}' to time ${new_date}`);
  //       await common.update_quiz_close_time(pool, quiz.id, new_time); // обновляем время окончания теста по unix timestamp
  //     }
  //   }
  // }

  await pool.end();
  await plt_conn.end();
})();