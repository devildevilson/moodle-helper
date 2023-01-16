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

const TEST_STANDART_TIME = 40*60;
const EXAM_STANDART_TIME = 50*60;

const TEST_STANDART_ATTEMPTS = 3;
const EXAM_STANDART_ATTEMPTS = 1;

const GET_TEACHER_COURSE_LIST_QUERY = 
`
SELECT mc.* FROM mdl_course mc 
JOIN mdl_enrol me ON mc.id = me.courseid
JOIN mdl_user_enrolments mue ON me.id = mue.enrolid
WHERE mue.userid = %d AND mc.visible = 1;
`;

(async () => {
  const pool = await mysql.createPool(connection_config);

  const teacher_id = 1412;
  const query_str = format(GET_TEACHER_COURSE_LIST_QUERY, teacher_id);
  const [ result, _ ] = await pool.query(query_str);
  //console.log(result);

  console.log("result length", result.length);
  for (const course of result) {
    console.log("course_id  :",course.id);
    console.log("course name:",course.fullname);
    //await find_categories(pool, teacher_id, course.id);

    const course_id = course.id;
    //if (course.id !== 7087) continue;

    {
      const exam_id = await common.find_quiz_by_name(pool, course_id, "Экзамен");
      const res = await common.check_quiz_and_fix(pool, exam_id, "exam");
      if (res) {
        console.log(`Fixed quiz Экзамен ${exam_id}`);
        continue;
      }
    }

    {
      const exam_id = await common.find_quiz_by_name(pool, course_id, "Емтихан");
      const res = await common.check_quiz_and_fix(pool, exam_id, "exam");
      if (res) {
        console.log(`Fixed quiz Емтихан ${exam_id}`);
        continue;
      }
    }

    const exam_exists = await common.find_quiz(pool, course_id, "exam");
    if (exam_exists) {
      console.log("Found relatively good exam");
      continue;
    }

    const vsk1_id = await common.find_quiz(pool, course_id, "vsk1");
    const vsk2_id = await common.find_quiz(pool, course_id, "vsk2");

    if (!vsk1_id) {
      console.log("Could not find VSK1 test, skipping");
      continue;
    }

    if (!vsk2_id) {
      console.log("Could not find VSK2 test, skipping");
      continue;
    }

    console.log("vsk1 found:",vsk1_id);
    console.log("vsk2 found:",vsk2_id);

    const vsk1_q_arr = await common.get_questions_from_quiz(pool, vsk1_id);
    const vsk2_q_arr = await common.get_questions_from_quiz(pool, vsk1_id);

    const exam_q_arr = [...vsk1_q_arr, ...vsk2_q_arr];
    console.log("exam question count", exam_q_arr.length);

    const open  = common.make_unix_timestamp("2022.12.19 00:00:00");
    const close = common.make_unix_timestamp("2023.01.06 23:55:00");
    const exam_id = await common.create_test_for_course(pool, course_id, "Экзамен", open, close, EXAM_STANDART_ATTEMPTS, EXAM_STANDART_TIME, "exam");

    console.log("exam_id:",exam_id);
    await common.create_questions_for_test(pool, teacher_id, course_id, exam_id, "exam", exam_q_arr);

    console.log("Created exam for ",course.fullname);
    console.log("\n");
    //break;
  }

  await pool.end();
  //console.log(__dirname);
  //console.log(process.cwd());
})();