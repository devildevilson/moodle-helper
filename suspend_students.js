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

const file_data = xlsx.parse(`dopusk.xlsx`);
//console.log(file_data[0].data);

(async () => {
	const mdl_pool = mysql.createPool(mdl_connection_config);
  //const plt_conn = await mysql.createConnection(plt_connection_config);

  for (let i = 1; i < file_data[0].data.length; ++i) {
  	const row = file_data[0].data[i];
    const name_arr = row[0].split(" ");
    const lastname = name_arr[0];
    const firstname = name_arr[1];

    const arr = await mdl_common.get_student_by_name(mdl_pool, firstname, lastname);
    if (arr.length === 0) {
    	console.log(`Could not find student '${lastname} ${firstname}'`);
    	continue;
    }

    if (arr.length > 1) {
    	console.log(`Found several students with name '${lastname} ${firstname}'`);
    	continue;
    }

    await mdl_common.suspend_user(mdl_pool, arr[0].id);
    //console.log(`Suspend user ${arr[0].id} '${lastname} ${firstname}'`);
  }

  await mdl_pool.end();
  //await plt_conn.end();
})();