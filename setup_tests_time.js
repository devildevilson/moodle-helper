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

const file_data = xlsx.parse(`prolongation_vsk1_2023.04.07.xlsx`);

(async () => {
  const mdl_pool = mysql.createPool(mdl_connection_config);
  const plt_conn = await mysql.createConnection(plt_connection_config);

  for (const row of file_data[0].data) {
    const course_id = parseInt(row[0]);
    if (isNaN(course_id)) continue;

    const test_id = parseInt(row[1]);
    if (isNaN(test_id)) continue;

    if (!row[6] || row[6] === "") continue;

    const opentime  = mdl_common.make_unix_timestamp(row[4].substring(1));
    const closetime = mdl_common.make_unix_timestamp(row[5].substring(1));
    //console.log(`${row[2]} ${row[3]} ${opentime} ${closetime}`);
    
    await mdl_common.update_quiz_time(mdl_pool, test_id, opentime, closetime);
  }

  await mdl_pool.end();
  await plt_conn.end();
})();