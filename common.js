const format = require("@stdlib/string-format");

const GET_COURSE_LAST_SECTION = 
`SELECT * FROM mdl_course_sections mcs WHERE mcs.course = %d AND mcs.section = 8;`;

const GET_PREV_QUIZ_FROM_TABLE = 
`
SELECT id FROM mdl_quiz 
WHERE course = %d AND name = '%s' AND timeopen = %d AND timeclose = %d AND attempts = %d AND timemodified = %d AND timelimit = %d AND plt_testtype = '%s' ORDER BY id DESC LIMIT 1;
`;

const INSERT_TEST_TO_TABLE_QUERY = 
`
INSERT INTO mdl_quiz (course, name, timeopen, timeclose, preferredbehaviour, attempts, questiondecimalpoints, shufflequestions, shuffleanswers, questions, timemodified, timelimit, browsersecurity, plt_testtype, reviewattempt, reviewcorrectness, reviewmarks, reviewspecificfeedback, reviewgeneralfeedback, reviewrightanswer, reviewoverallfeedback, grade)
              VALUES (    %d,  '%s',       %d,       %d, 'deferredfeedback',       %d,                    -1,                1,              1,        '',           %d,        %d,             '-',         '%s',         69904,              4368,        4368,                   4368,                  4368,              4368,                  4352, 100.0);
`;

const INSERT_TEST_TO_COURSE_MODULES = 
`
INSERT INTO mdl_course_modules (course, module, instance, section, added, visible)
                        VALUES (    %d,     12,       %d,      %d,    %d,      %d);
`;

const GET_PREV_MODULE_FROM_TABLE = 
`
SELECT id FROM mdl_course_modules WHERE course = %d AND module = 12 AND instance = %d AND section = %d AND added = %d AND visible = %d ORDER BY id DESC LIMIT 1;
`;

const GET_SEQUENCE_FROM_COURSE_SECTION = 
`
SELECT sequence FROM mdl_course_sections WHERE id = %d;
`;

const UPDATE_MODULE_TO_COURSE_SECTION_SEQUENCE = 
`
UPDATE mdl_course_sections 
SET sequence = '%s'
WHERE id = %d;
`;

const GET_MODINFO_FROM_COURSE = 
`
SELECT modinfo FROM mdl_course WHERE id = %d;
`;

const UPDATE_MODINFO_IN_COURSE = 
`
UPDATE mdl_course SET modinfo = '%s' WHERE id = %d;
`;

const FIND_COURSE_CATEGORY_CONTEXT = 
`
SELECT * FROM mdl_context WHERE instanceid = %d AND contextlevel = %d;
`;

const FIND_CATEGORY_IN_CONTEXT = 
`
SELECT * FROM mdl_question_categories WHERE name = '%s' AND contextid = %d ORDER BY id DESC LIMIT 1;
`;

const INSERT_CATEGORY = 
`
INSERT INTO mdl_question_categories (name, contextid, info)
                             VALUES ('%s',        %d, '%s');
`;

const FIND_LAST_QUESTION_IN_CATEGORY = 
`
SELECT * FROM mdl_question WHERE category = %d AND parent = %d AND timecreated = %d AND createdby = %d ORDER BY id DESC LIMIT 1;
`;

const INSERT_QUESTION_IN_CATEGORY = 
`
INSERT INTO mdl_question (category, parent, name, questiontext, questiontextformat, generalfeedbackformat, penalty, qtype, hidden, timecreated, timemodified, createdby, modifiedby)
                  VALUES (      %d,     %d, '%s',         '%s',                 %d,                    %d,      %f,  '%s',     %d,          %d,           %d,        %d,         %d);
`;

const INSERT_QUESTION_ANSWERS = 
`
INSERT INTO mdl_question_answers (question, answer, answerformat, fraction, feedback, feedbackformat)
                          VALUES (      %d,   '%s',            1,       %f,       '',              1);
`;

const FIND_QUESTION_ANSWERS = 
`
SELECT * FROM mdl_question_answers WHERE question = %d;
`;

const FIND_RANDOM_QUESTIONS = 
`
SELECT * FROM mdl_question WHERE qtype = 'random' AND hidden = 1 AND category = %d AND timecreated = %d AND createdby = %d;
`;

const UPDATE_TEST_WITH_RND_QUESTIONS = 
`
UPDATE mdl_quiz SET questions = '%s', sumgrades = %f WHERE id = %d;
`;

const INSERT_RND_QUESTIONS_INTO_INSTANCES = 
`
INSERT INTO mdl_quiz_question_instances (quiz, question, grade)
                                 VALUES (  %d,       %d,   1.0);
`;

const INSERT_QUESTION_INTO_MULTICHOISE = 
`
INSERT INTO mdl_question_multichoice (question, answers, single, correctfeedback, correctfeedbackformat, partiallycorrectfeedback, partiallycorrectfeedbackformat, incorrectfeedback, incorrectfeedbackformat) 
                              VALUES (      %d,    '%s',      1,              '',                     1,                       '',                              1,                '',                       1);
`;

function make_valid_sql_string(str) {
  return str.replace("'", "\"");
}

function make_valid_apostrophe(str) {
  return str.replaceAll("'", "''");
}

function get_last_index_from_result(res) {
  const [ _, value ] = Object.entries(res[0])[0];
  return value;
}

function make_unix_timestamp(time_str) {
  return parseInt((new Date(time_str).getTime() / 1000).toFixed(0));
}

async function insert_question(pool, teacher_id, category_id, name, questiontext) {
  const created = make_unix_timestamp((new Date()).toString());
  //console.log("teacher_id",teacher_id);
  //console.log("category_id",category_id);
  //console.log("created",created);
  {
    const query_str = format(INSERT_QUESTION_IN_CATEGORY, category_id, 0, make_valid_sql_string(name), make_valid_sql_string(questiontext), 1, 1, 0.33, "multichoice", 0, created, created, teacher_id, teacher_id);
    await pool.query(query_str);
  }

  let question_id = 0;
  {
    const query_str = format(FIND_LAST_QUESTION_IN_CATEGORY, category_id, 0, created, teacher_id);
    const [ result, _ ] = await pool.query(query_str);
    question_id = result[0].id;
  }

  return question_id;
}

async function insert_answers(pool, question_id, answers_arr) {
  const row_str = ` (%d, '%s', 1, %f, '', 1)`;

  //console.log(answers_arr);
  let query_str = "INSERT INTO mdl_question_answers (question, answer, answerformat, fraction, feedback, feedbackformat) VALUES";
  for (let i = 0; i < answers_arr.length; ++i) {
    //const query_str = format(INSERT_QUESTION_ANSWERS, question_id, answer, i == 0 ? 1.0 : 0.0);
    const formated_row = format(row_str, question_id, make_valid_sql_string(answers_arr[i]), i == 0 ? 1.0 : 0.0);
    query_str += (i == 0 ? "" : ",") + formated_row;
  }

  query_str += ';';
  await pool.query(query_str);

  const query_str2 = format(FIND_QUESTION_ANSWERS, question_id);
  const [ result, _ ] = await pool.query(query_str2);
  let ans_id = [];
  for (const r of result) {
    ans_id.push(r.id);
  }
  return ans_id;
}

async function insert_random_questions(pool, teacher_id, category_id, name, count) {
  const created = make_unix_timestamp((new Date()).toString());
  const row_str = ` (%d, id, '%s', '%s', %d, %d, %f, '%s', %d, %d, %d, %d, %d)`;

  let query_str = `INSERT INTO mdl_question (category, parent, name, questiontext, questiontextformat, generalfeedbackformat, penalty, qtype, hidden, timecreated, timemodified, createdby, modifiedby) VALUES`;
  for (let i = 0; i < count; ++i) {
    const formated_row = format(row_str, category_id, make_valid_sql_string(name), '1', 0, 0, 0.0, "random", 1, created, created, teacher_id, teacher_id);
    query_str += (i == 0 ? "" : ",") + formated_row;
  }

  query_str += ';';
  await pool.query(query_str);

  const query_str2 = format(FIND_RANDOM_QUESTIONS, category_id, created, teacher_id);
  const [ result, _ ] = await pool.query(query_str2);
  let rnd_questons_ids = [];
  for (const q of result) {
    const query_str3 = `UPDATE mdl_question SET parent = ${q.id} WHERE id = ${q.id};`;
    await pool.query(query_str3);
    rnd_questons_ids.push(q.id);
  }

  return rnd_questons_ids;
}

async function insert_random_questions_instances(pool, quiz_id, questions_arr) {
  const row_str = " (%d, %d, 1.0)";

  let counter = 0;
  let query_str = "INSERT INTO mdl_quiz_question_instances (quiz, question, grade) VALUES";
  for (const q_id of questions_arr) {
    const formated_row = format(row_str, quiz_id, q_id);
    query_str += (counter == 0 ? "" : ",") + formated_row;
    counter += 1;
  }

  query_str += ';';
  await pool.query(query_str);
}

async function get_course_last_section(pool, course_id) {
  const query_str = `SELECT * FROM mdl_course_sections WHERE course = ${course_id} ORDER BY section DESC LIMIT 1;`; //AND section = 8
  const [ result, _ ] = await pool.query(query_str);
  return result.length !== 0 ? result[0].id : undefined;
}

async function create_quiz(pool, course_id, name, open_time, close_time, attempts_count, created, time, type) {
  const query_str = 
  `INSERT INTO mdl_quiz (     course ,    name  ,    timeopen ,    timeclose , preferredbehaviour,         attempts , questiondecimalpoints, shufflequestions, shuffleanswers, questions, timemodified, timelimit, browsersecurity, plt_testtype, reviewattempt, reviewcorrectness, reviewmarks, reviewspecificfeedback, reviewgeneralfeedback, reviewrightanswer, reviewoverallfeedback, grade)
                 VALUES (${course_id}, '${name}', ${open_time}, ${close_time}, 'deferredfeedback', ${attempts_count},                    -1,                1,              1,        '',   ${created},   ${time},             '-',    '${type}',         69904,              4368,        4368,                   4368,                  4368,              4368,                  4352, 100.0);`;

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  await conn.query(query_str);
  const [ res, _ ] = await conn.query("SELECT LAST_INSERT_ID();");
  await conn.commit()
  conn.release();

  return get_last_index_from_result(res);
}

async function create_course_module(pool, course_id, instance_id, section_id, created, visible) {
  const query_str = 
  `INSERT INTO mdl_course_modules (     course , module,      instance ,      section ,     added ,   visible )
                           VALUES (${course_id},     12, ${instance_id}, ${section_id}, ${created}, ${visible});`;

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  await conn.query(query_str);
  const [ res, _ ] = await conn.query("SELECT LAST_INSERT_ID();");
  await conn.commit()
  conn.release();

  return get_last_index_from_result(res);
}

async function create_test_for_course(pool, course_id, name, open_time, close_time, attempts_count, time, type) {
  const section_id = await get_course_last_section(pool, course_id);
  if (!section_id) return undefined;

  // создаем запись в таблице тестов
  const created = make_unix_timestamp((new Date()).toString());
  const quiz_id = await create_quiz(pool, course_id, name, open_time, close_time, attempts_count, created, time, type);
  // {
  //   const query_str = format(INSERT_TEST_TO_TABLE_QUERY, course_id, name, open_time, close_time, attempts_count, created, time, type);
  //   await pool.query(query_str);
  // }

  // // получаем только что вставленный айдишник
  // let quiz_id = 0;
  // {
  //   const query_str = format(GET_PREV_QUIZ_FROM_TABLE, course_id, name, open_time, close_time, attempts_count, created, time, type);
  //   const [ result, _ ] = await pool.query(query_str);
  //   quiz_id = result[0].id;
  // }

  const visible = 1;
  const module_id = await create_course_module(pool, course_id, quiz_id, section_id, created, visible);

  // const visible = 1;
  // // создаем запись в таблице модулей для курса
  // {
  //   const query_str = format(INSERT_TEST_TO_COURSE_MODULES, course_id, quiz_id, section_id, created, visible);
  //   await pool.query(query_str);
  // }

  // // получаей айдишник для модуля
  // let module_id = 0;
  // {
  //   const query_str = format(GET_PREV_MODULE_FROM_TABLE, course_id, quiz_id, section_id, created, visible);
  //   const [ result, _ ] = await pool.query(query_str);
  //   module_id = result[0].id;
  // }

  // получаем строку последовательности модулей
  let sequence = "";
  {
    const query_str = format(GET_SEQUENCE_FROM_COURSE_SECTION, section_id);
    const [ result, _ ] = await pool.query(query_str);
    sequence = result[0].sequence;
  }

  sequence += ','+module_id; // id модуля вставляем в последовательность 

  {
    const query_str = format(UPDATE_MODULE_TO_COURSE_SECTION_SEQUENCE, sequence, section_id);
    await pool.query(query_str);
  }

  // получаем текст modinfo (наверное это все модули скомпанованные для быстрой загрузки (?))
  let modinfo = "";
  {
    const query_str = format(GET_MODINFO_FROM_COURSE, course_id);
    const [ result, _ ] = await pool.query(query_str);
    modinfo = result[0].modinfo;
  }

  // нужно сделать 2 вещи: увеличить число перед первой скобкой
  // и добавить специальную запись в конец этого текста 
  //console.log("modinfo",modinfo);
  const index = modinfo ? modinfo.indexOf('{') : 0;
  const sub = modinfo ? modinfo.substring(0, index) : "";
  const sub_arr = sub.split(":");
  //console.log("sub_arr:", sub_arr);
  const new_value = sub_arr.length < 2 ? 1 : parseInt(sub_arr[1])+1;
  const new_prefix = `a:${new_value}:`;

  const quiz_id_length = (quiz_id+'').length;
  const module_id_length = (module_id+'').length;
  const section_id_length = (section_id+'').length;
  const created_length = (created+'').length;
  const additional_value = `i:${module_id};O:8:"stdClass":10:{s:2:"id";s:${quiz_id_length}:"${quiz_id}";s:2:"cm";s:${module_id_length}:"${module_id}";s:3:"mod";s:4:"quiz";s:7:"section";s:1:"8";s:9:"sectionid";s:${section_id_length}:"${section_id}";s:6:"module";s:2:"12";s:5:"added";s:${created_length}:"${created}";s:7:"visible";s:1:"0";s:10:"visibleold";s:1:"1";s:4:"name";s:${name.length}:"${name}";}`;

  let leftover = modinfo ? modinfo.substring(index+1, modinfo.length) : "";
  leftover = leftover.length == 0 ? "" : leftover.substring(0, leftover.length-1);
  leftover += '{';
  leftover += additional_value;
  leftover += '}';
  // поможет ли? нет почему то не помогло, что делать?
  const updated_info = make_valid_apostrophe(new_prefix+leftover);
  //console.log(updated_info);

  // обновляем текст на сервере
  {
    const query_str = format(UPDATE_MODINFO_IN_COURSE, updated_info, course_id);
    await pool.query(query_str);
  }

  return quiz_id;
}

async function create_questions_for_test(pool, teacher_id, course_id, quiz_id, qtype, q_arr) {
  let res = [];
  {
    const query_str = format(FIND_COURSE_CATEGORY_CONTEXT, course_id, 50);
    const [ result, _ ] = await pool.query(query_str);
    res = result;
  }

  for (const r of res) {
    // создам вопросы тогда наверное в контексте
    //console.log("context_id:",r.id);
    const category_name = "q "+qtype;

    {
      const query_str = format(INSERT_CATEGORY, category_name, r.id, "generated category");
      await pool.query(query_str);
    }

    let category_id = 0;
    {
      const query_str = format(FIND_CATEGORY_IN_CONTEXT, category_name, r.id);
      const [ result, _ ] = await pool.query(query_str);
      category_id = result[0].id;
    }

    //console.log("category_id:",category_id);

    for (const q of q_arr) {
      if (q.answers.length == 0) {
        console.log("No answers found for ", q.name);
        continue;
      }

      const question_id = await insert_question(pool, teacher_id, category_id, q.name, q.text);
      const ans_id = await insert_answers(pool, question_id, q.answers);
      const query_str = format(INSERT_QUESTION_INTO_MULTICHOISE, question_id, ans_id.join(","));
      await pool.query(query_str);
    }

    const rnd_questons_id = await insert_random_questions(pool, teacher_id, category_id, "random "+category_name, qtype === "exam" ? 40 : 30);
    {
      const rnd_str = rnd_questons_id.join(",");
      const query_str = format(UPDATE_TEST_WITH_RND_QUESTIONS, rnd_str, rnd_questons_id.length, quiz_id);
      await pool.query(query_str);
    }

    await insert_random_questions_instances(pool, quiz_id, rnd_questons_id);
  }
}

async function create_course(pool, fullname, shortname, idnumber, startdate) {
  const time = make_unix_timestamp(new Date());
  const query_str = 
  `INSERT INTO mdl_course (category,     fullname ,     shortname ,     idnumber , summary, summaryformat, modinfo, newsitems,   startdate , numsections, maxbytes, timecreated, timemodified) 
                   VALUES (       1, '${fullname}', '${shortname}', '${idnumber}',      '',             1,      '',         5, ${startdate},           8, 56623104,     ${time},      ${time});`;

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  await conn.query(query_str);
  const [ res, _ ] = await conn.query("SELECT LAST_INSERT_ID();");
  await conn.commit()
  conn.release();

  return get_last_index_from_result(res);
}

async function get_last_added_course_id(pool, idnumber) {
  const query_str = `SELECT * FROM mdl_course WHERE idnumber = '${idnumber}' ORDER BY id DESC LIMIT 1;`;
  const [ result, _ ] = await pool.query(query_str);
  return result[0].id;
}

async function create_enrol(pool, course_id) {
  const time = make_unix_timestamp(new Date());
  const query_str = //expirythreshold
  `INSERT INTO mdl_enrol (   enrol, status,    courseid , sortorder, roleid, customint1, customint2, customint3, customint4, timecreated, timemodified) 
                  VALUES ('manual',      0, ${course_id},         0,      5,       NULL,       NULL,       NULL,       NULL,     ${time},      ${time}),
                         ( 'guest',      1, ${course_id},         1,      0,       NULL,       NULL,       NULL,       NULL,     ${time},      ${time}),
                         (  'self',      1, ${course_id},         2,      5,          0,   10368000,          0,          0,     ${time},      ${time});`;

  await pool.query(query_str);
}

async function create_enrol_and_get(pool, course_id, type) {
  if (!(type === "manual" || type === "guest" || type === "self")) throw "get_last_added_enrol_id Wrong type";
  const time = make_unix_timestamp(new Date());
  const query_str = //expirythreshold
  `INSERT INTO mdl_enrol (   enrol, status,    courseid , sortorder, roleid, customint1, customint2, customint3, customint4, timecreated, timemodified) 
                  VALUES ('manual',      0, ${course_id},         0,      5,       NULL,       NULL,       NULL,       NULL,     ${time},      ${time}),
                         ( 'guest',      1, ${course_id},         1,      0,       NULL,       NULL,       NULL,       NULL,     ${time},      ${time}),
                         (  'self',      1, ${course_id},         2,      5,          0,   10368000,          0,          0,     ${time},      ${time});`;

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  await conn.query(query_str);
  const [ res, _ ] = await conn.query(`SELECT id FROM mdl_enrol WHERE courseid = ${course_id} AND enrol = '${type}' ORDER BY id DESC LIMIT 1;`);
  await conn.commit()
  conn.release();

  return res[0].id;
}

async function get_last_added_enrol_id(pool, course_id, type) {
  if (!(type === "manual" || type === "guest" || type === "self")) throw "get_last_added_enrol_id Wrong type";
  const query_str = `SELECT * FROM mdl_enrol WHERE courseid = ${course_id} AND enrol = '${type}' ORDER BY id DESC LIMIT 1;`;
  const [ result, _ ] = await pool.query(query_str);
  return result[0].id;
}

async function enrol_user(pool, enrol_id, user_id) {
  const time = make_unix_timestamp(new Date());
  const query_str = 
  `INSERT INTO mdl_user_enrolments (   enrolid ,    userid , timestart, timecreated, timemodified) 
                            VALUES (${enrol_id}, ${user_id},   ${time},     ${time},      ${time});`;

  await pool.query(query_str);
}


async function create_context(pool, course_id) {
  const query_str = 
  `INSERT INTO mdl_context (contextlevel,  instanceid , path, depth) 
                    VALUES (          50, ${course_id},   '',     2);`;

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  await conn.query(query_str);
  const [ res, _ ] = await conn.query("SELECT LAST_INSERT_ID();");
  const ctx_id = get_last_index_from_result(res);
  await conn.query(`UPDATE mdl_context SET path = '/1/3/${ctx_id}' WHERE id = ${ctx_id};`);
  await conn.commit()
  conn.release();

  return ctx_id;
}

async function assign_role(pool, user_id, context_id, role_id) {
  const time = make_unix_timestamp(new Date());
  const query_str = 
  `INSERT INTO mdl_role_assignments (   roleid ,    contextid ,    userid , timemodified, modifierid, component)
                             VALUES (${role_id}, ${context_id}, ${user_id},      ${time}, ${user_id},        '');`;
  await pool.query(query_str);
}

async function create_section(pool, course_id, section_index, name) {
  if (name) {
    const query_str = 
    `INSERT INTO mdl_course_sections (     course ,         section ,     name , summary) 
                              VALUES (${course_id}, ${section_index},   ${name},      '');`;

    await pool.query(query_str);
  } else {
    const query_str = 
    `INSERT INTO mdl_course_sections (     course ,         section , name, summary) 
                              VALUES (${course_id}, ${section_index},   '',      '');`;

    await pool.query(query_str);
  }
}

async function create_default_blocks(pool, ctx_id) {
  const query_str = 
  `INSERT INTO mdl_block_instances (   blockname , parentcontextid, showinsubcontexts, pagetypepattern, defaultweight, configdata, defaultregion)
                            VALUES (  'dndupload',       ${ctx_id},                 0, 'course-view-*',             1,         '',   'side-post'),
                                   ( 'news_items',       ${ctx_id},                 0, 'course-view-*',             0,         '',   'side-post'),
                                   ('course_list',       ${ctx_id},                 0, 'course-view-*',             1,         '',    'side-pre'),
                                   (      'tutor',       ${ctx_id},                 0, 'course-view-*',             0,         '',    'side-pre');`;

  await pool.query(query_str);
}

async function get_user_by_name(pool, first_name, last_name) {
  const GET_STUDENT_ROWS = `SELECT * FROM mdl_user WHERE firstname = '%s' AND lastname = '%s' AND suspended = 0 AND deleted = 0;`;
  const query_str = format(GET_STUDENT_ROWS, first_name, last_name);
  const [ results, _ ] = await pool.query(query_str);
  return results;
}

async function get_teachers(pool) {
  const access = make_unix_timestamp("2022.09.01 00:00:00");
  const GET_MDL_TEACHERS = `SELECT * FROM mdl_user WHERE idnumber LIKE 't%';`;
  const [ result, _ ] = await pool.query(GET_MDL_TEACHERS);
  let teachers = [];
  for (const t of result) {
    if (t.lastaccess < access) continue;

    teachers.push(t);
  }

  return teachers;
}

async function get_teacher_by_plt_id(pool, plt_id) {
  const GET_MDL_TEACHERS = `SELECT * FROM mdl_user WHERE idnumber = 't${plt_id}';`;
  const [ res, _ ] = await pool.query(GET_MDL_TEACHERS);
  return res.length !== 0 ? res[0] : undefined;
}

// user_id может быть или студентом или преподом
async function get_courses(pool, user_id) {
  const query_str = `
    SELECT mc.* FROM mdl_course mc 
    JOIN mdl_enrol me ON mc.id = me.courseid
    JOIN mdl_user_enrolments mue ON me.id = mue.enrolid
    WHERE mue.userid = ${user_id} AND mc.visible = 1;
  `;

  const [ results, _ ] = await pool.query(query_str);
  return results;
}

async function get_course_context(pool, course_id) {
  const query_str = `SELECT * FROM mdl_context WHERE contextlevel = 50 AND instanceid = ${course_id};`;
  const [ results, _ ] = await pool.query(query_str);
  return results[0];
}

async function get_context_blocks(pool, ctx_id) {
  const query_str = `SELECT * FROM mdl_block_instances WHERE parentcontextid = ${ctx_id};`;
  const [ results, _ ] = await pool.query(query_str);
  return results;
}

async function get_raw_quizes(pool, course_id, qtype) {
  // получаем секции, обходим их
  const GET_COURSE_MODULES = 
  `SELECT * FROM mdl_course_modules WHERE instance = %d AND visible = %d AND module = %d;`;

  const GET_QUIZES_FROM_TABLE = `SELECT * FROM mdl_quiz WHERE course = %d AND plt_testtype = '%s';`;
  //const GET_CATEGORY_FROM_QUESTION = `SELECT category FROM mdl_question WHERE id = %d;`;
  //const GET_QUESTIONS_FROM_CATEGORY = `SELECT * FROM mdl_question WHERE category = %d AND qtype = 'multichoice';`;

  const query_str = format(GET_QUIZES_FROM_TABLE, course_id, qtype);
  const [ results, _ ] = await pool.query(query_str);

  let ret = [];
  for (const q of results) {
    const module_query = format(GET_COURSE_MODULES, q.id, 1, 12);
    const [ module_results, _ ] = await pool.query(module_query);
    if (module_results.length == 0) continue;

    ret.push(q);
  }

  return ret;
}

// async function get_course_tests(pool, course_id) {
//   const query_str = `
//     SELECT * FROM mdl_quiz mq 
//     JOIN mdl_course_modules mcm ON mcm.visible = 1 AND mcm.module = 12 AND mcm.instance = mq.id 
//     WHERE mq.course = ${course_id};
//   `;

//   const [ res, _ ] = await pool.query(query_str);
//   return res;
// }

async function get_quiz_attempts(pool, quiz_id, user_id) {
  const GET_QUIZ_ATTEMPTS = `SELECT * FROM mdl_quiz_attempts WHERE quiz = %d AND userid = %d;`;
  const query_str = format(GET_QUIZ_ATTEMPTS, quiz_id, user_id);
  const [ results, _ ] = await pool.query(query_str);
  return results;
}

async function get_course_sections(pool, course_id) {
  const query_str = `SELECT * FROM mdl_course_sections WHERE course = ${course_id} AND section < 8;`;
  const [ results, _ ] = await pool.query(query_str);
  return results;
} 

async function find_quiz(pool, course_id, qtype) {
  return find_valid_quiz(pool, course_id, qtype);
}

async function find_valid_quiz(pool, course_id, qtype) {
  // получаем секции, обходим их
  const GET_COURSE_SECTIONS = 
  `SELECT * FROM mdl_course_modules WHERE instance = %d AND visible = %d AND module = %d;`;

  const GET_QUIZES_FROM_TABLE = `SELECT * FROM mdl_quiz WHERE course = %d AND plt_testtype = '%s';`;
  const GET_CATEGORY_FROM_QUESTION = `SELECT category FROM mdl_question WHERE id = %d;`;
  const GET_QUESTIONS_FROM_CATEGORY = `SELECT * FROM mdl_question WHERE category = %d AND qtype = 'multichoice';`;
  //const GET_QUESTIONS_FROM_CATEGORY = `SELECT * FROM mdl_question WHERE category = %d AND qtype = 'random';`;

  //const sec_q_str = format(GET_COURSE_SECTIONS, course_id);
  //const [ sections, _ ] = await pool.query(sec_q_str);
  const required_question_count = qtype === "exam" ? 40 : 30;

  const query_str = format(GET_QUIZES_FROM_TABLE, course_id, qtype);
  const [ results, _ ] = await pool.query(query_str);
  for (const q of results) {
    if (q.questions === "") continue;
    
    const module_query = format(GET_COURSE_SECTIONS, q.id, 1, 12);
    const [ module_results, _ ] = await pool.query(module_query);
    if (module_results.length == 0) continue;

    const questions_arr = q.questions.split(",");
    //console.log(q.questions);
    // if (questions_arr.length !== required_question_count) {
    //   console.log("Required question count: "+required_question_count+"\n");
    //   console.log(qtype+" amount         : "+questions_arr.length);
    // }

    const question_id = parseInt(questions_arr[0]);
    const q_str = format(GET_CATEGORY_FROM_QUESTION, question_id);
    const [ results, _1 ] = await pool.query(q_str);
    const category_id = results[0].category;

    const q_str2 = format(GET_QUESTIONS_FROM_CATEGORY, category_id);
    const [ quiz_questions, _2 ] = await pool.query(q_str2);
    const quiz_id = q.id;
    if (quiz_questions.length > 0) return quiz_id;
  }

  return undefined;
}

async function find_quiz_by_name(pool, course_id, name) {
  const GET_QUIZES_FROM_TABLE = `SELECT * FROM mdl_quiz WHERE course = %d;`;
  const GET_COURSE_QUIZ_MODULE = `SELECT * FROM mdl_course_modules WHERE instance = %d AND visible = %d AND module = %d;`;

  const final_name = name.toLowerCase().trim();
  const query_str = format(GET_QUIZES_FROM_TABLE, course_id);
  const [ quizes, _ ] = await pool.query(query_str);
  for (const q of quizes) {
    const q_name = q.name.toLowerCase().trim();
    if (q_name === final_name) {
      const query_str = format(GET_QUIZES_FROM_TABLE, q.id, 1, 12);
      const [ modules, _ ] = await pool.query(query_str);
      if (modules.length == 0) continue;
      return q.id;
    }
  }

  return undefined;
}

async function check_quiz_and_fix(pool, quiz_id, qtype) {
  if (!quiz_id) return false;
  //const question_count = qtype === "exam" ? 40 : 30;
  const test_time = qtype === "exam" ? 50*60 : 40*60;
  const attempts = qtype === "exam" ? 1 : 3;
  const is_exam = qtype === "exam";
  // let open = 0;
  // let close = 0;
  // if (qtype === "exam") {
  //   open  = make_unix_timestamp("2022.12.19 00:00:00");
  //   close = make_unix_timestamp("2022.01.06 23:55:00");
  // } else if (qtype === "vsk2") {
  //   open  = make_unix_timestamp("2022.12.12 00:00:00");
  //   close = make_unix_timestamp("2022.12.18 23:55:00");
  // } else {
  //   open  = make_unix_timestamp("2022.11.07 00:00:00");
  //   close = make_unix_timestamp("2022.11.25 23:55:00");
  // }

  const GET_QUIZ_FROM_TABLE = `SELECT * FROM mdl_quiz WHERE id = %d;`;

  const query_str = format(GET_QUIZ_FROM_TABLE, quiz_id);
  const [ result, _ ] = await pool.query(query_str);
  const test = result[0];

  const q_arr = test.questions.split(",");
  if (q_arr.length < 20) {
    const GET_COURSE_MODULE = `UPDATE mdl_course_modules SET visible = %d WHERE instance = %d;`;
    const query_str3 = format(GET_COURSE_MODULE, 0, quiz_id);
    await pool.query(query_str3);
    return false;
  }

  if (is_exam) {
    //const open  = make_unix_timestamp("2022.12.19 00:00:00");
    //const close = make_unix_timestamp("2022.01.06 23:55:00");
    //, timeopen = %d, timeclose = %d
    const UPDATE_QUIZ = `UPDATE mdl_quiz SET questionsperpage = %d, attempts = %d, timelimit = %d, plt_testtype = '%s' WHERE id = %d;`;
    const query_str2 = format(UPDATE_QUIZ, 0, attempts, test_time, qtype, quiz_id); //open, close
    await pool.query(query_str2);
    return true;
  }

  //timeopen = %d, timeclose = %d, 
  const UPDATE_QUIZ = `UPDATE mdl_quiz SET questionsperpage = %d, attempts = %d, timelimit = %d, plt_testtype = '%s' WHERE id = %d;`;
  const query_str2 = format(UPDATE_QUIZ, 0, attempts, test_time, qtype, quiz_id);
  await pool.query(query_str2);
  return true;
}

async function update_quiz_close_time(pool, quiz_id, close) {
  const UPDATE_QUIZ = `UPDATE mdl_quiz SET timeclose = %d WHERE id = %d;`;
  const query_str = format(UPDATE_QUIZ, close, quiz_id);
  await pool.query(query_str);
}

async function delete_attempt_from_quiz(pool, attempt_id) {
  const DELETE_ATTEMPT = `DELETE FROM mdl_quiz_attempts WHERE id = %d;`;
  const query_str = format(DELETE_ATTEMPT, attempt_id);
  await pool.query(query_str);
}

// вопросы могут быть в подкатегории
async function get_questions_from_quiz(pool, quiz_id) {
  const GET_QUIZE_FROM_TABLE = `SELECT * FROM mdl_quiz WHERE id = %d;`;
  const GET_CATEGORY_FROM_QUESTION = `SELECT category FROM mdl_question WHERE id = %d;`;
  const GET_QUESTIONS_FROM_CATEGORY = `SELECT * FROM mdl_question WHERE category = %d AND qtype = 'multichoice';`;
  const GET_ANSWERS_FOR_QUESTION = `SELECT * FROM mdl_question_answers WHERE question = %d ORDER BY fraction DESC;`;

  const query_str = format(GET_QUIZE_FROM_TABLE, quiz_id);
  const [ quiz, _ ] = await pool.query(query_str);

  if (quiz[0].questions === "") return [];

  const questions_arr = quiz[0].questions.split(",");
  const question_id = parseInt(questions_arr[0].trim());
  const q_str = format(GET_CATEGORY_FROM_QUESTION, question_id);
  const [ results, _1 ] = await pool.query(q_str);

  const category_id = results[0].category;
  const q_str2 = format(GET_QUESTIONS_FROM_CATEGORY, category_id);
  const [ quiz_questions, _2 ] = await pool.query(q_str2);

  let q_arr = [];
  for (const q of quiz_questions) {
    const q_str3 = format(GET_ANSWERS_FOR_QUESTION, q.id);
    const [ question_answers, _3 ] = await pool.query(q_str3); 

    let fraction_sum = 0.0; // должна быть больше 0
    let ans_arr = [];
    for (const a of question_answers) {
      ans_arr.push(a.answer);
      fraction_sum += a.fraction;
    }

    const local_q = {
      name: q.name,
      text: q.questiontext,
      answers: ans_arr,
      fraction_sum
    };

    q_arr.push(local_q);
  }

  return q_arr;
}

async function find_course_with_idnumber(pool, idnumber) {
  const query_str = `SELECT * FROM mdl_course WHERE visible = 1 AND idnumber = '${idnumber}'`;
  const [ res, _ ] = await pool.query(query_str);
  return res.length !== 0 ? res[0] : undefined;
}

async function get_course_tests(pool, course_id)
//async function get_course_tests(course_id) 
{
  //const module_id= 12;
  const query_str = 
  `SELECT mq.*,mcm.id AS module_id FROM mdl_quiz mq 
   INNER JOIN mdl_course_modules mcm ON mq.id = mcm.instance 
   WHERE mcm.course = ${course_id} AND mcm.module = 12 AND mcm.visible = 1;`;
  const [ res, _ ] = await pool.query(query_str);
  return res;
}

async function update_quiz_time(pool, quiz_id, time_open, time_close) {
  const query_str = `UPDATE mdl_quiz SET timeopen = ${time_open}, timeclose = ${time_close} WHERE id = ${quiz_id};`;
  await pool.query(query_str);

  console.log(`SQL: UPDATE mdl_quiz: SET timeopen = ${time_open}, timeclose = ${time_close} WHERE id = ${quiz_id}`);
}

async function get_user_idnumber(pool, user_id) {
  const query_str = `SELECT idnumber FROM mdl_user WHERE id = ${user_id};`;
  const [ res, _ ] = await pool.query(query_str);
  return res.length !== 0 ? res[0].idnumber : undefined;
}

async function get_course_by_plt_data(pool, tutor_id, subject_id, study_form, lang_num) {
  const course_idnumber = `${tutor_id}-${subject_id}-${study_form}-${lang_num}`;
  const query_str = `
    SELECT * FROM mdl_course WHERE idnumber = '${course_idnumber}';
  `;

  const [ res, _ ] = await pool.query(query_str);
  //console.log(course_idnumber);
  //console.log(res);
  return res.length !== 0 ? res[0] : undefined;
}

async function create_question_category(pool, module_id, quiz_id, course_ctx, name, desc) {
  const query_ctx = `SELECT * FROM mdl_context WHERE contextlevel = 70 AND instanceid = ${module_id};`;
  const insert_ctx = `INSERT INTO mdl_context (contextlevel, instanceid, depth) VALUES (70, ${module_id}, 4);`;

  let context_id = undefined;
  {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const [ res, _ ] = await conn.query(query_ctx);
    if (res.length !== 0) {
      context_id = res[0].id;
    } else {
      await conn.query(insert_ctx);
      const [ [ { ctx_id } ], _ ] = await conn.query("SELECT LAST_INSERT_ID() AS ctx_id;");
      const update_ctx = `UPDATE mdl_context SET path = '${course_ctx.path}/${context_id}' WHERE id = ${context_id};`;
      await conn.query(update_ctx);
      context_id = ctx_id;
    }
    await conn.commit();
    conn.release();
  }

  const insert_cat = `
    INSERT INTO mdl_question_categories (   name  ,    contextid ,    info  , infoformat, parent, sortorder)
                                 VALUES ('${name}', ${context_id}, '${desc}',          0,      0,       999);
  `;

  const conn = await pool.getConnection();
  await conn.beginTransaction();
  await conn.query(insert_cat);
  const [ [ { cat_id } ], _ ] = await conn.query("SELECT LAST_INSERT_ID() AS cat_id;");
  await conn.commit();
  conn.release();

  return cat_id;
}

async function get_category_questions_id_from_test(pool, question_string) {
  //const query_str = `SELECT id FROM mdl_question WHERE category IN (SELECT category FROM mdl_question WHERE id IN (${question_string}) GROUP BY category);`;
  const query_str = `SELECT category FROM mdl_question WHERE id IN (${question_string});`;
  const [ res, _ ] = await pool.query(query_str);
  let set = new Set();
  for (const { category } of res) {
    set.add(category);
  }
  const categories = Array.from(set).join(",");
  const query2_str = `SELECT id FROM mdl_question WHERE category IN (${categories}) AND qtype = 'multichoice';`;
  const [ res2, _2 ] = await pool.query(query2_str);
  return res2;
}

function make_ans_str(ans_start, ans_count) {
  let str = "";
  for (let i = ans_start; i < ans_start+ans_count-1; ++i) {
    str = str + i + ",";
  }
  str = str + (ans_start+ans_count-1);
  return str;
}

async function copy_questions_to_category(pool, question_string, cat_id) {
  const q_id_arr = await get_category_questions_id_from_test(pool, question_string);
  //console.log(`q_id_arr length ${q_id_arr.length}`);
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  // тут вопросы из категории нужно брать
  for (const { id } of q_id_arr) {
    const insert_question_str = `
      INSERT INTO mdl_question (category, name, questiontext, questiontextformat, generalfeedbackformat, qtype, timecreated, timemodified, createdby, modifiedby, generalfeedback)
      SELECT ${cat_id}, name, questiontext, questiontextformat, generalfeedbackformat, qtype, timecreated, timemodified, createdby, modifiedby, ''
      FROM mdl_question
      WHERE id = ${id};
    `;

    await conn.query(insert_question_str);
    const [ [ { new_q_id } ], _1 ] = await conn.query("SELECT LAST_INSERT_ID() AS new_q_id;");
    const insert_ans_str = `
      INSERT INTO mdl_question_answers (answer, answerformat, fraction, feedbackformat, question, feedback)
      SELECT answer, answerformat, fraction, feedbackformat, ${new_q_id}, ''
      FROM mdl_question_answers
      WHERE question = ${id};
    `;
    await conn.query(insert_ans_str);
    const [ [ { ans_start } ], _2 ] = await conn.query("SELECT LAST_INSERT_ID() AS ans_start;");
    const [ [ { ans_count } ], _3 ] = await conn.query(`SELECT COUNT(*) AS ans_count FROM mdl_question_answers WHERE question = ${id};`);
    const ans_str = make_ans_str(ans_start, ans_count);
    //console.log(ans_start, ans_count);

    const insert_mult = `
      INSERT INTO mdl_question_multichoice (  question ,    answers  , single, correctfeedbackformat, partiallycorrectfeedbackformat, incorrectfeedbackformat)
                                    VALUES (${new_q_id}, '${ans_str}',      1,                     1,                              1,                       1);`;

    await conn.query(insert_mult);
  }
  await conn.commit();
  conn.release();
}

async function create_random_questions(pool, category_id, count, user_id) {
  const current_time = make_unix_timestamp(new Date());
  let q_id_arr = [];
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  for (let i = 0; i < count; ++i) {
    // надоб добавить стамп и версию do.esil.edu.kz+230502063638+gkbiWW
    const query_str = `
      INSERT INTO mdl_question (     category ,                     name , questiontext, generalfeedbackformat,   qtype , penalty,    timecreated ,   timemodified , createdby , modifiedby, generalfeedback)
                        VALUES (${category_id}, 'rand from exam category',          '1',                    '', 'random',       0, ${current_time}, ${current_time}, ${user_id}, ${user_id}, '');
    `;

    await conn.query(query_str);
    const [ [ { new_q_id } ], _ ] = await conn.query("SELECT LAST_INSERT_ID() AS new_q_id;");
    const update_str = `UPDATE mdl_question SET parent = ${new_q_id} WHERE id = ${new_q_id};`;
    await conn.query(update_str);
    q_id_arr.push(new_q_id);
  }
  await conn.commit();
  conn.release();

  return q_id_arr;
}

async function set_test_questions(pool, test_id, questions_arr) {
  for (const q of questions_arr) {
    const insert_str = `INSERT INTO mdl_quiz_question_instances (quiz, question, grade) VALUES (${test_id}, ${q}, 1);`;
    await pool.query(insert_str);
  }

  const questions_arr_str = questions_arr.join(",");
  const query_str = `UPDATE mdl_quiz SET questions = '${questions_arr_str}', sumgrades = ${questions_arr.length} WHERE id = ${test_id};`;
  const [ res, _ ] = await pool.query(query_str);
  return res;
}

async function get_student_by_name(pool, firstname, lastname) {
  const query_str = `SELECT * FROM mdl_user WHERE lastname = '${lastname}' AND firstname = '${firstname}';`;
  const [ res, _ ] = await pool.query(query_str);
  return res;
}

async function suspend_user(pool, id) {
  const query_str = `UPDATE mdl_user SET suspended = 1 WHERE id = ${id};`;
  await pool.query(query_str);
}

module.exports = {
  make_unix_timestamp,
  insert_question,
  insert_answers,
  insert_random_questions,
  insert_random_questions_instances,
  get_course_last_section,
  create_test_for_course,
  create_questions_for_test,
  create_course,
  get_last_added_course_id,
  create_enrol,
  create_enrol_and_get,
  get_last_added_enrol_id,
  enrol_user,
  create_context,
  assign_role,
  create_section,
  create_default_blocks,
  create_quiz,
  create_course_module,
  get_user_by_name,
  get_teachers,
  get_teacher_by_plt_id,
  get_courses,
  get_course_context,
  get_context_blocks,
  get_raw_quizes,
  get_quiz_attempts,
  get_course_sections,
  find_quiz,
  find_valid_quiz,
  find_quiz_by_name,
  check_quiz_and_fix,
  update_quiz_close_time,
  delete_attempt_from_quiz,
  get_questions_from_quiz,
  find_course_with_idnumber,
  get_course_tests,
  update_quiz_time,
  get_user_idnumber,
  get_course_by_plt_data,
  create_question_category,
  copy_questions_to_category,
  create_random_questions,
  set_test_questions,
  get_student_by_name,
  suspend_user,

};