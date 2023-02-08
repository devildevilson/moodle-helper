const format = require("@stdlib/string-format");

const study_form_set = new Set([3, 8, 19, 20, 30]);

async function get_teacher_subjects(pool, id) {
  const curr_month = new Date().getMonth();
  const august_month = 7;
  let term = 2;
  let curr_year = new Date().getFullYear();
  if (curr_month <= august_month) {
    term = 1;
    curr_year = curr_year-1;
  }

  const GET_SUBJECTS = `SELECT * FROM tutorsubject WHERE TutorID = ${id} AND study_year = ${curr_year} ;`; // AND Term = ${term} AND isMain = 1
  const [ result, _ ] = await pool.query(GET_SUBJECTS);

  let subjects = [];
  for (const sub of result) {
    const GET_STUDY_GROUP = `SELECT * FROM studygroups WHERE tutorSubjectID = ${sub.TutorSubjectID} AND Term = ${term} AND isMain = 1;`;
    const [ groups, _ ] = await pool.query(GET_STUDY_GROUP);
    if (groups.length == 0) continue;
    if (!study_form_set.has(sub.studyForm)) continue;
    
    //console.log(groups);
    subjects.push(sub);
  }

  return subjects;
}

async function get_study_groups(pool, tutor_id, subject_id, study_form) {
  const curr_month = new Date().getMonth();
  const august_month = 7;
  let term = 1;
  let curr_year = new Date().getFullYear();
  if (curr_month <= august_month) {
    term = 2;
    curr_year = curr_year-1;
  }

  // AND Term = ${term} AND isMain = 1
  const GET_SUBJECTS = `SELECT * FROM tutorsubject WHERE TutorID = ${tutor_id} AND SubjectID = ${subject_id} AND study_year = ${curr_year} AND studyForm = ${study_form};`;
  const [ result, _ ] = await pool.query(GET_SUBJECTS);

  let study_groups = [];
  for (const sub of result) {
    const GET_STUDY_GROUP = `SELECT * FROM studygroups WHERE tutorSubjectID = ${sub.TutorSubjectID} AND Term = ${term} AND isMain = 1;`;
    const [ groups, _ ] = await pool.query(GET_STUDY_GROUP);
    if (groups.length == 0) continue;
    
    return study_groups.concat(groups);
  }

  return study_groups;
}

async function get_subject(pool, subject_id, lang) {
  const query_str = `SELECT * FROM subjects WHERE SubjectID = ${subject_id};`;
  const [ result, _ ] = await pool.query(query_str);
  const sub = result[0];

  return sub;
}



module.exports = {
  get_teacher_subjects,
  get_study_groups,
  get_subject
};