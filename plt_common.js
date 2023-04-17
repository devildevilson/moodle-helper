const format = require("@stdlib/string-format");

//const study_form_set = new Set([3, 8, 19, 30]);
// 3  - ДОТ на базе высшего
// 9  - ДОТ оч 3г
// 19 - ДОТ 4г
// 20 - ДОТ заочное 3г
// 30 - ДОТ колледж 2г

async function get_teacher_subjects(pool, id) {
  const curr_month = new Date().getMonth();
  const august_month = 7;
  let term = 1;
  let curr_year = new Date().getFullYear();
  if (curr_month <= august_month) {
    term = 2;
    curr_year = curr_year-1;
  }

  // const GET_SUBJECTS = `SELECT * FROM tutorsubject WHERE TutorID = ${id} AND study_year = ${curr_year};`; // AND Term = ${term} AND isMain = 1
  // const [ result, _ ] = await pool.query(GET_SUBJECTS);

  // let subjects = [];
  // for (const sub of result) {
  //   const GET_STUDY_GROUP = `SELECT * FROM studygroups WHERE tutorSubjectID = ${sub.TutorSubjectID} AND Term = ${term} AND isMain = 1;`;
  //   const [ groups, _ ] = await pool.query(GET_STUDY_GROUP);
  //   if (groups.length == 0) continue;
  //   if (!study_form_set.has(sub.studyForm)) continue;
    
  //   //console.log(groups);
  //   subjects.push(sub);
  // }

  //return subjects;

  const query_str = `
    SELECT * FROM studygroups sg
    JOIN tutorsubject ts ON ts.TutorID = ${id} AND ts.study_year = ${curr_year} AND ts.studyForm IN (3, 8, 19, 30)
    WHERE sg.tutorSubjectID = ts.TutorSubjectID AND sg.Term = ${term} AND sg.isMain = 1 AND sg.deleted = 0;
  `;

  //console.log(query_str);
  const [ result, _ ] = await pool.query(query_str);
  return result;
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

  //console.log(`${curr_year} ${term}`);

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

async function get_study_groups_by_year(pool, year, term) {
  const query_str = 
  `SELECT * FROM studygroups sg 
     JOIN tutorsubject ts ON ts.TutorSubjectID = sg.tutorSubjectID 
     WHERE sg.year = ${year} AND sg.Term = ${term} AND sg.isMain = 1 AND sg.studentCount != 0 AND ts.studyForm IN (3, 8, 19, 20, 30)
  ;`; // GROUP BY sg.tutorSubjectID

  const [ res, _ ] = await pool.query(query_str);
  return res;
}

async function get_subject(pool, subject_id, lang) {
  const query_str = `SELECT * FROM subjects WHERE SubjectID = ${subject_id};`;
  const [ result, _ ] = await pool.query(query_str);
  const sub = result[0];

  return sub;
}

async function get_tutor(pool, tutor_id) {
  const query_str = `SELECT * FROM tutors WHERE TutorID = ${tutor_id};`;
  const [ res, _ ] = await pool.query(query_str);
  return res.length !== 0 ? res[0] : undefined;
}

async function get_tutor_subject(pool, tutor_subject_id) {
  const query_str = `SELECT * FROM tutorsubject WHERE TutorSubjectID = ${tutor_subject_id};`;
  const [ res, _ ] = await pool.query(query_str);
  return res.length !== 0 ? res[0] : undefined;
}

async function get_subject(pool, subject_id) {
  const query_str = `SELECT * FROM subjects WHERE SubjectID = ${subject_id};`;
  const [ res, _ ] = await pool.query(query_str);
  return res.length !== 0 ? res[0] : undefined;
}

async function get_study_groups_data_by_student_id(pool, student_id, year, term) {
  const query_str = `
    SELECT sg.StudyGroupID,sg.tutorSubjectID,sg.groupname,sg.tutorid,ts.SubjectID,ts.language,ts.studyForm FROM studygroups sg 
    INNER JOIN studentstudygroup ssg ON sg.StudyGroupID = ssg.studyGroupID 
    INNER JOIN tutorsubject ts ON ts.TutorSubjectID = sg.tutorSubjectID
    WHERE sg.isMain = 1 AND sg.studentCount > 0 AND ssg.StudentID = ${student_id} AND sg.Term = ${term} AND sg.year = ${year};
  `;
  const [ res, _ ] = await pool.query(query_str);
  return res;
}

async function get_students_by_group_id(pool, id) {
  const query_str = `
    SELECT s.StudentID,s.Login,s.Password,s.firstname,s.lastname,s.patronymic,s.mail FROM students s 
    JOIN studentstudygroup ssg ON ssg.studyGroupID = ${id} 
    WHERE s.StudentID = ssg.StudentID;
  `;
  const [ res, _ ] = await pool.query(query_str);
  return res;
}

module.exports = {
  get_teacher_subjects,
  get_study_groups,
  get_subject,
  get_study_groups_by_year,
  get_tutor,
  get_tutor_subject,
  get_subject,
  get_study_groups_data_by_student_id,
  get_students_by_group_id,
  
};