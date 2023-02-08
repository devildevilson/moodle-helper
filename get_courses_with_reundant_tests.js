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

const test_type = [ "vsk1", "vsk2", "exam" ];

(async () => {
  const mdl_pool = mysql.createPool(mdl_connection_config);

  const teachers = await mdl_common.get_teachers(mdl_pool);
  for (const t of teachers) {
    const courses = await mdl_common.get_courses(mdl_pool, t.id);
    for (const course of courses) {
      for (const type of test_type) {
        const found_quizes = await mdl_common.get_raw_quizes(mdl_pool, course.id, type);
        if (found_quizes.length > 1) {
          console.log(`Found ${found_quizes.length} ${type} tests in ${course.id} ${course.fullname}`);
          break;
        }
      }
    }
  }

  await mdl_pool.end();
})();