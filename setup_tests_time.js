require("dotenv").config();
const mysql = require("mysql2/promise");
const mdl_common = require("./common");
const plt_common = require("./plt_common");
const xlsx = require("node-xlsx");
const fs = require("fs");

const mdl_connection_config = {
  host     : process.env.MDL_DATABASE_HOST,
  port     : process.env.MDL_DATABASE_PORT,
  user     : process.env.MDL_DATABASE_USER,
  password : process.env.MDL_DATABASE_PASSWORD,
  database : process.env.MDL_DATABASE_NAME,
  connectionLimit: 10,
  connectTimeout: 1000000,
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

//const file_data = xlsx.parse(`prolongation_term1_2023.06.19.xlsx`);
const file_data = xlsx.parse(`prolongation_term2_2023.06.19.xlsx`);
const STUDENT_ID      =  0;
const COURSE_ID       =  1;
const TEST_ID         =  2;
const STUDENT_NAME    =  3;
const COURCE_NAME     =  4;
const COURCE_NUM      =  5;
const TEST_TYPE       =  6;
const TIME_START      =  7;
const TIME_END        =  8;
const PROLONG_NEEDED  =  9;
const DELETE_ATTEMPTS = 10;

(async () => {
  const mdl_pool = mysql.createPool(mdl_connection_config);
  const plt_conn = await mysql.createConnection(plt_connection_config);

  let backup_attempts = [];
  let prolong_count = 0;
  let remove_count = 0;
  for (const row of file_data[0].data) {
    const course_id = parseInt(row[COURSE_ID]);
    if (isNaN(course_id)) continue;

    const test_id = parseInt(row[TEST_ID]);
    if (isNaN(test_id)) continue;

    if (!row[PROLONG_NEEDED] || row[PROLONG_NEEDED].trim() === "") continue;

    const opentime  = mdl_common.make_unix_timestamp(row[TIME_START].substring(1));
    const closetime = mdl_common.make_unix_timestamp(row[TIME_END].substring(1));
    //console.log(`${row[TIME_START]} ${row[TIME_END]} ${opentime} ${closetime}`);

    await mdl_common.update_quiz_time(mdl_pool, test_id, opentime, closetime);
    prolong_count += 1;
    // удалить старые попытки?
    //if (!row[DELETE_ATTEMPTS] || row[DELETE_ATTEMPTS] === "") continue;

    const plt_id = row[STUDENT_ID].substring(1);
    const user = await mdl_common.get_student_by_plt_id(mdl_pool, plt_id);
    const attempts = await mdl_common.get_quiz_attempts(mdl_pool, test_id, user.id);
    backup_attempts.push(...attempts);
    //await mdl_common.remove_attempts(mdl_pool, test_id, user.id);
    remove_count += 1;
  }

  console.log(`Prolongation count ${prolong_count}`);
  console.log(`Removal      count ${remove_count}`);

  await mdl_pool.end();
  await plt_conn.end();

  const insert_fields = [
    "uniqueid", "quiz", "userid", "attempt", "sumgrades", "timestart", "timefinish", "timemodified", "layout", "preview", "needsupgradetonewqe"
  ];

  if (backup_attempts.length > 0) {
    const fields_comma = insert_fields.join(", ");
    let fields_placing = {};
    for (let i = 0; i < insert_fields.length; ++i) {
      fields_placing[insert_fields[i]] = i;
    }

    let sql_str = `INSERT INTO (${fields_comma}) VALUES \n`;
    let row_data = [];
    row_data.length = insert_fields.length;
    let attempts_str = [];
    for (const attempt of backup_attempts) {
      for (let i = 0; i < row_data.length; ++i) { row_data[i] = ""; }

      for (const [ key, value ] of Object.entries(attempt)) {
        if (key === "id") continue;

        let final_value = "";
        if (typeof value === "string") final_value = `'${value}'`;
        else final_value = `${value}`;

        const index = fields_placing[key];
        if (!index) throw `Could not find field '${key}'`;
        row_data[index] = final_value;
      }

      const attempt_data = `(${row_data.join(", ")})`;
      attempts_str.push(attempt_data);
    }

    const all_data = attempts_str.join(", \n");
    sql_str += all_data;
    sql_str += ";";

    const cur_date = new Date().toString().replaceAll(" ", "_");
    console.log(`Writing ${attempts_str.length} sql rows`);
    fs.writeFile(`attempts_backup_${cur_date}.sql`, sql_str, err => {
      if (err) { console.error(err); return; }
      console.log(`Success computing`);
    });
  }
})();