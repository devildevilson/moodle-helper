require("dotenv").config();
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

const GET_TEACHER_COURSE_LIST_QUERY = 
`
SELECT mc.* FROM mdl_course mc 
JOIN mdl_enrol me ON mc.id = me.courseid
JOIN mdl_user_enrolments mue ON me.id = mue.enrolid
WHERE mue.userid = %d AND mc.visible = 1;
`;

async function check_all_tests(pool, course_id) {
  const tests_data = {
    "Экзамен":"exam",
    "Емтихан":"exam",

    "Рубежный контроль 1":"vsk1",
    "1 Рубежный контроль":"vsk1",
    "Рубежка 1":"vsk1",
    "1 Рубежка":"vsk1",
    "Рубежный контроль 2":"vsk2",
    "2 Рубежный контроль":"vsk2",
    "Рубежка 2":"vsk2",
    "2 Рубежка":"vsk2",

    "Аралық бақылау 1":"vsk1",
    "1 Аралық бақылау":"vsk1",
    "Аралық бақылау 2":"vsk2",
    "2 Аралық бақылау":"vsk2",
  };

  for (const [ key, val ] of Object.entries(tests_data)) {
    const test_id = await common.find_quiz_by_name(pool, course_id, key);
    if (!test_id) { continue; } //console.log(`Could not find ${key}, skipped`); 
    const res = await common.check_quiz_and_fix(pool, test_id, val);
    if (res) console.log(`Fixed quiz ${key} ${test_id}`);
    else console.log(`Quiz ${key} ${test_id} invalid`);
  }
}

(async () => {
  const pool = await mysql.createPool(connection_config);

  const access = common.make_unix_timestamp("2022.09.01 00:00:00");
  const GET_MDL_TEACHERS = `SELECT * FROM mdl_user WHERE idnumber LIKE 't%';`;
  const [ result, _ ] = await pool.query(GET_MDL_TEACHERS);
  console.log("teacher count", result.length);
  let counter = 0;
  for (const t of result) {
    if (t.lastaccess < access) continue;
    const teacher_id = t.id;

    const query_str = format(GET_TEACHER_COURSE_LIST_QUERY, teacher_id);
    const [ result, _ ] = await pool.query(query_str);
    console.log(`Teacher ${t.lastname} ${t.firstname} has ${result.length} courses`);
    for (const course of result) {
      console.log(course.fullname);
      await check_all_tests(pool, course.id);
    }

    ++counter;
  }

  console.log("Checked "+counter+" teachers");

  await pool.end();
})();