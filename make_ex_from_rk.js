require("dotenv").config();
const mysql = require("mysql2/promise");
const format = require("@stdlib/string-format");
const mdl_common = require("./common");
const plt_common = require("./plt_common");

const mdl_connection_config = {
  host     : process.env.MDL_DATABASE_HOST,
  port     : process.env.MDL_DATABASE_PORT,
  user     : process.env.MDL_DATABASE_USER,
  password : process.env.MDL_DATABASE_PASSWORD,
  database : process.env.MDL_DATABASE_NAME,
  connectionLimit: 10,
};

const mdl_id = process.argv[2];
if (typeof mdl_id !== "string" || isNaN(mdl_id)) {
  console.log(`Could not parse user id arg '${mdl_id}'`);
  return;
}

(async () => {
  const mdl_pool = mysql.createPool(mdl_connection_config);

  // че мы делаем? мы должны проверить все курсы преподавателя
  // если в нем есть exam то проверим есть ли в нем вопросы
  // если вопросов нет то мы должны что сделать?
  // создать категорию, добавить в категорию вопросы из рубежки 
  const courses = await mdl_common.get_courses(mdl_pool, mdl_id);
  for (const course of courses) {
    console.log(`Creating exam in course ${course.id} ${course.fullname}`);
    const tests = await mdl_common.get_course_tests(mdl_pool, course.id);
    let valid_vsk1 = undefined;
    let valid_vsk2 = undefined;
    let exam_test = undefined;
    for (const test of tests) {
      if (typeof test.plt_testtype === "string" && test.plt_testtype === "exam" && !exam_test) {
        exam_test = test;
      }

      if (typeof test.plt_testtype === "string" && test.plt_testtype === "vsk1" && !valid_vsk1 && test.questions && test.questions !== "") {
        valid_vsk1 = test;
      }

      if (typeof test.plt_testtype === "string" && test.plt_testtype === "vsk2" && !valid_vsk2 && test.questions && test.questions !== "") {
        valid_vsk2 = test;
      }
    }

    if (!exam_test) {
      console.log(`Could not find exam test in course ${course.id} ${course.fullname}`);
      continue;
    }

    if (exam_test.questions && exam_test.questions !== "" && exam_test.questions !== "0") {
      console.log(`exam ${exam_test.id} has questions, skip`);
      continue;
    }
    
    if (!valid_vsk1) {
      console.log(`Could not find valid vsk1 test in course ${course.id} ${course.fullname}`);
      continue;
    }

    if (!valid_vsk2) {
      console.log(`Could not find valid vsk2 test in course ${course.id} ${course.fullname}`);
      continue;
    }

    const questions1 = valid_vsk1.questions.split(",");
    const questions2 = valid_vsk2.questions.split(",");

    if (questions1.length < 30) {
      console.log(`WARNING: vsk1 test has less than 30 questions in course ${course.id} ${course.fullname}`);
    }

    if (questions2.length < 30) {
      console.log(`WARNING: vsk2 test has less than 30 questions in course ${course.id} ${course.fullname}`);
    }

    const ctx = await mdl_common.get_course_context(mdl_pool, course.id);
    const cat_id = await mdl_common.create_question_category(mdl_pool, exam_test.module_id, exam_test.id, ctx, "exam", "generated");
    // в эту категорию сложим вопросы из категорий
    await mdl_common.copy_questions_to_category(mdl_pool, valid_vsk1.questions, cat_id);
    await mdl_common.copy_questions_to_category(mdl_pool, valid_vsk2.questions, cat_id);
    // создадим случайные вопросы
    const arr = await mdl_common.create_random_questions(mdl_pool, cat_id, 40, mdl_id);
    await mdl_common.set_test_questions(mdl_pool, exam_test.id, arr);

    console.log(`Created  exam in course ${course.id} ${course.fullname}`);
  }

  await mdl_pool.end();
})();