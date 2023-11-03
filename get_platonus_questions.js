require("dotenv").config();
const mysql = require("mysql2/promise");
const format = require("@stdlib/string-format");
const mdl_common = require("./common");
const plt_common = require("./plt_common");
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

const course_id = parseInt(process.argv[2]);
if (isNaN(course_id)) { console.log(`Expected first arg to be a course id`); return; }
const category_name = process.argv[3] ? process.argv[3] : "Экзамен";

(async () => {
  //const plt_conn = await mysql.createConnection(plt_connection_config);

  const query_str = `
    SELECT mco.fullname AS course_name,mq.id AS question_id, mq.questiontext,mqa.answer,mqa.fraction 
    FROM mdl_question_answers mqa
    JOIN mdl_question mq ON mq.id = mqa.question
    JOIN mdl_question_categories mqc ON mq.category = mqc.id
    JOIN mdl_context mc ON mqc.contextid = mc.id
    JOIN mdl_course mco ON mc.path LIKE CONCAT((SELECT mc1.path FROM mdl_context mc1 WHERE mc1.instanceid = mco.id AND mc1.contextlevel = 50), "%")
    WHERE mco.id = ${course_id} AND mqc.name LIKE '%${category_name}%' AND mq.qtype != 'random';
  `;

  const mdl_pool = mysql.createPool(mdl_connection_config);
  const [ res ] = await mdl_pool.query(query_str);
  await mdl_pool.end();

  if (res.length === 0) { console.log(`Could not find any questions in course ${course_id} and question category '${category_name}'`); return; }

  console.log(`Found ${res.length} rows (about ${res.length / 5} questions)`);
  const course_name = res[0].course_name;
  let question_bank = {};
  for (const q_data of res) {
    if (!question_bank[q_data.question_id]) question_bank[q_data.question_id] = { q: "", answers: [] };
    question_bank[q_data.question_id].q = q_data.questiontext;
    if (Math.abs(parseFloat(q_data.fraction)) < 0.00001) question_bank[q_data.question_id].answers.push(q_data.answer);
    else question_bank[q_data.question_id].answers.unshift(q_data.answer);
  }

  const values = Object.values(question_bank);
  let format_string = "";
  for (const value of values) {
    format_string += `<question>${value.q}\n`;
    for (const answer of value.answers) {
      format_string += `<variant>${answer}\n`;
    }

    format_string += "\n";
  }

  const file_name = `${course_id} ${course_name}.txt`;
  fs.writeFileSync(file_name, format_string);
  console.log(`Wrote ${values.length} questions in '${file_name}'`);
})();