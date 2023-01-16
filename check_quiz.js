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

async function quiz_checker(pool, quiz_id, quiz_name) {
  console.log(`Checking quiz ${quiz_id} ${quiz_name}`);

  const q_questions = await common.get_questions_from_quiz(pool, quiz_id);
  if (q_questions.length == 0) {
    console.log(`Quiz ${quiz_id} ${quiz_name} has 0 questions`);
    return;
  }

  let counter = 0;
  for (const quest of q_questions) {
    if (quest.fraction_sum < 1.0) counter += 1;
  }

  if (counter != 0) console.log(`Quiz ${quiz_id} ${quiz_name} has ${counter} bad questions`);
}

const GET_COURSE_BY_ID = `SELECT * FROM mdl_course WHERE id=%d;`;

(async () => {
  const pool = await mysql.createPool(connection_config);

  const course_id = 6888;
  const query_str = format(GET_COURSE_BY_ID, course_id);
  const [ result, _ ] = await pool.query(query_str);
  const course = result[0];
  console.log(`Checking course ${course.fullname}`);

  const vsk1_arr = await common.get_raw_quizes(pool, course_id, "vsk1");
  const vsk2_arr = await common.get_raw_quizes(pool, course_id, "vsk2");
  const exam_arr = await common.get_raw_quizes(pool, course_id, "exam");

  for (const q of vsk1_arr) {
    await quiz_checker(pool, q.id, q.name);
  }

  for (const q of vsk2_arr) {
    await quiz_checker(pool, q.id, q.name);
  }

  for (const q of exam_arr) {
    await quiz_checker(pool, q.id, q.name);
  }

  //console.log("End checking");
  await pool.end();
})();