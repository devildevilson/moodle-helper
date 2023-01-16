require("dotenv").config();
const mysql = require("mysql2/promise");
const format = require("@stdlib/string-format");
const common = require("./common");

const connection_config = {
  host     : process.env.DATABASE_HOST,
  port     : process.env.DATABASE_PORT,
  user     : process.env.DATABASE_USER,
  password : process.env.DATABASE_PASSWORD,
  database : process.env.DATABASE_NAME,
  connectionLimit: 10,
};

// возможно было бы неплохо эти данные получить из аргументов
const changing_data = {
  //vsk1: "2023.01.06 23:55:00",
  vsk2: "2023.01.10 23:55:00",
  exam: "2023.01.11 23:55:00",
};

const course_id = ;

(async () => {
  const pool = await mysql.createPool(connection_config);

  // затем в курсах нужно найти все тесты по типу
  for (const [ qtype, new_date ] of Object.entries(changing_data)) {
    const quizes = await common.get_raw_quizes(pool, course_id, qtype); // получаем список тестов по типу
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

  await pool.end();
})();