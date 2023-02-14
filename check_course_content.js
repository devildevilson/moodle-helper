require("dotenv").config();
const mysql = require("mysql2/promise");
const format = require("@stdlib/string-format");
const mdl_common = require("./common");
const plt_common = require("./plt_common");

// как проверить курсы? во первых нужно взять все курсы второго семестра
// во вторых обходим все секции этого курса
// и тут у нас 2 варианта: 
// 1) если секции пустые кроме последней, то этот курс точно нужно заполнить
// 2) в каких то секциях может что то лежать, но это не доконца заполненный курс
// вариант 2) не знаю как делать

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

(async () => {
  const mdl_pool = mysql.createPool(mdl_connection_config);
  const plt_conn = await mysql.createConnection(plt_connection_config);

  const teachers = await mdl_common.get_teachers(mdl_pool);
  for (const t of teachers) {
    console.log(`teacher: ${t.firstname} ${t.lastname} ${t.idnumber} ${t.id}`);

    const courses = await mdl_common.get_courses(mdl_pool, t.id);
    const plt_id = parse_teacher_id(t.idnumber);
    const subjects = await plt_common.get_teacher_subjects(plt_conn, plt_id);

    let courses_map = {};
    for (const course of courses) {
      if (courses_map[course.idnumber]) continue;
      courses_map[course.idnumber] = course;
    }

    for (const sub of subjects) {
      const idnumber = make_course_id_number(sub.TutorID, sub.SubjectID, sub.studyForm, sub.language);
      if (!courses_map[idnumber]) continue;

      const study_groups = await plt_common.get_study_groups(plt_conn, sub.TutorID, sub.SubjectID, sub.studyForm);
      //console.log(`study_groups.length: ${study_groups.length}`);
      if (study_groups.length === 0) continue;

      const course = courses_map[idnumber];
      // теперь надо просмотреть все секции у курса
      // а в секциях что? там мы проверяем сиквенс, 
      // если хотя бы 3 раздела пусты

      let count_empty_sections = 0;
      const sections = await mdl_common.get_course_sections(mdl_pool, course.id);
      for (const section of sections) {
        if (section.sequence === null || section.sequence === undefined || section.sequence === "") {
          ++count_empty_sections;
        }
      }

      if (count_empty_sections >= 3) {
        console.log(`${course.id} ${course.fullname} has ${count_empty_sections} empty sections`);
      }
    }
  }

  await mdl_pool.end();
  await plt_conn.end();
})();