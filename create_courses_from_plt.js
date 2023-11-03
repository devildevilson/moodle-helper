require("dotenv").config();
const mysql = require("mysql2/promise");
const format = require("@stdlib/string-format");
const mdl_common = require("./common");
const plt_common = require("./plt_common");

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

function parse_teacher_id(idnumber) {
  if (idnumber[0] !== 't') return undefined;
  const str = idnumber.substring(1);
  return parseInt(str);
}

function make_course_id_number(plt_teacher_id, plt_course_id, study_form, lang_id) {
  return `${plt_teacher_id}-${plt_course_id}-${study_form}-${lang_id}`;
}

function make_start_date() {
  const cur_date = new Date();
  const year = cur_date.getFullYear();
  const month = cur_date.getMonth();
  const august_month = 7;
  let start_date_str = `${year}.01.01 00:00:00`;
  if (month > august_month) {
    start_date_str = `${year}.09.01 00:00:00`;
  }

  return start_date_str;
}

function make_end_date() {
  const cur_date = new Date();
  const year = cur_date.getFullYear();
  const month = cur_date.getMonth();
  const august_month = 7;
  let date_str = `${year}.08.31 23:59:00`;
  if (month > august_month) {
    date_str = `${year}.12.31 23:59:00`;
  }

  return date_str;
}

function get_subject_name(sub, lang) {
  if (lang == 1) return sub.SubjectNameRU;
  else if (lang == 2) return sub.SubjectNameKZ;
  return sub.SubjectNameENG;
}

function get_subject_code(sub, lang) {
  return sub.SubjectCodeRu;
}

const current_tests_time = {
  0: {
    vsk1: { name: "Рубежный контроль 1", open: "2023.06.19 00:00:00", close: "2023.06.25 23:55:00", attempts: 3, time: 40*60 },
    vsk2: { name: "Рубежный контроль 2", open: "2023.06.26 00:00:00", close: "2023.07.02 23:55:00", attempts: 3, time: 40*60 },
    exam: { name: "Экзамен",             open: "2023.07.03 00:00:00", close: "2023.07.09 23:55:00", attempts: 1, time: 50*60 },
  },
  1: {
    vsk1: { name: "Рубежный контроль 1", open: "2023.06.19 00:00:00", close: "2023.06.25 23:55:00", attempts: 3, time: 40*60 },
    vsk2: { name: "Рубежный контроль 2", open: "2023.06.26 00:00:00", close: "2023.07.02 23:55:00", attempts: 3, time: 40*60 },
    exam: { name: "Экзамен",             open: "2023.07.03 00:00:00", close: "2023.07.09 23:55:00", attempts: 1, time: 50*60 },
  },
  2: {
    vsk1: { name: "Рубежный контроль 1", open: "2023.06.19 00:00:00", close: "2023.06.25 23:55:00", attempts: 3, time: 40*60 },
    vsk2: { name: "Рубежный контроль 2", open: "2023.06.26 00:00:00", close: "2023.07.02 23:55:00", attempts: 3, time: 40*60 },
    exam: { name: "Экзамен",             open: "2023.07.03 00:00:00", close: "2023.07.09 23:55:00", attempts: 1, time: 50*60 },
  }
};

function get_year_term() {
  const current_date = new Date();
  const cur_month = current_date.getMonth()+1; // 0 index based
  const cur_year = current_date.getFullYear();
  const august_month = 7;
  const june_month = 5;
  if (cur_month < june_month) { return { year: cur_year-1, term: 2 }; }
  if (cur_month < august_month) { return { year: cur_year-1, term: 0 }; }
  return { year: cur_year, term: 1 };
}

(async () => {
  const mdl_pool = mysql.createPool(mdl_connection_config);
  const plt_conn = await mysql.createConnection(plt_connection_config);
  
  const { year, term } = get_year_term();

  for (let i = 0; i < 3; ++i) {
    const term1 = i;
    if (term1 === 0) console.log("Летний семестр");
    else console.log(`Cеместр ${term1}`);

    const study_groups = await plt_common.get_study_groups_by_year(plt_conn, year, term1);
    console.log(`Found ${study_groups.length} study groups`);
    for (const group of study_groups) {
      if (group.tutorid === 0) continue;
      const course_idnumber = `${group.tutorid}-${group.SubjectID}-${group.studyForm}-${group.language}`;
      const teacher = await mdl_common.get_teacher_by_plt_id(mdl_pool, group.tutorid);
      if (!teacher) continue;
      if (teacher.id !== 2491) continue;

      console.log(`teacher: ${teacher.firstname} ${teacher.lastname} ${teacher.idnumber} ${teacher.id}`);

      const course = await mdl_common.find_course_with_idnumber(mdl_pool, course_idnumber);
      let cur_course_id = course ? course.id : undefined;
      if (!cur_course_id) {
        const plt_subject = await plt_common.get_subject(plt_conn, group.SubjectID);
        const name = get_subject_name(plt_subject, group.language);
        const subj_code = get_subject_code(plt_subject, group.language);
        const shortname = `${subj_code}-${group.studyForm}-${group.language}-${group.SubjectID}`;
        const startdate = mdl_common.make_unix_timestamp(make_start_date());

        console.log(`Creating ${name} ${shortname}`);

        const course_id = await mdl_common.create_course(mdl_pool, name, shortname, course_idnumber, startdate);
        const enrol_id = await mdl_common.create_enrol_and_get(mdl_pool, course_id, "manual");
        await mdl_common.enrol_user(mdl_pool, enrol_id, teacher.id);
        const ctx_id = await mdl_common.create_context(mdl_pool, course_id);
        await mdl_common.assign_role(mdl_pool, teacher.id, ctx_id, 3); // 3 - учитель

        // 9 секций [0,8]
        for (let i = 0; i < 9; ++i) {
          await mdl_common.create_section(mdl_pool, course_id, i, undefined);
        }

        await mdl_common.create_default_blocks(mdl_pool, ctx_id);

        console.log(`Created  ${name} ${shortname} ${course_id}`);

        cur_course_id = course_id;

        //cur_course_id = undefined;
      }

      if (!cur_course_id) continue;

      let tests_set = new Set([ "vsk1", "vsk2", "exam" ]);
      const tests = await mdl_common.get_course_tests(mdl_pool, cur_course_id);
      for (const test of tests) {
        if (typeof test.plt_testtype !== "string") continue;

        if (tests_set.has(test.plt_testtype)) {
          tests_set.delete(test.plt_testtype);
        }
      }

      for (const type of tests_set) {
        const quiz_data = current_tests_time[term1][type];
        const open = mdl_common.make_unix_timestamp(quiz_data.open);
        const close = mdl_common.make_unix_timestamp(quiz_data.close);
        const quiz_id = await mdl_common.create_test_for_course(mdl_pool, cur_course_id, quiz_data.name, open, close, quiz_data.attempts, quiz_data.time, type);
        if (quiz_id) console.log(`Created quiz ${type} ${quiz_id}`);
        else console.log(`Could not create quiz for course ${cur_course_id}`);
      }
    }
  }

  console.log("Created");

  await mdl_pool.end();
  await plt_conn.end();
})();
