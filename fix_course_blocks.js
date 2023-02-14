require("dotenv").config();
const mysql = require("mysql2/promise");
const format = require("@stdlib/string-format");
const mdl_common = require("./common");

const mdl_connection_config = {
  host     : process.env.MDL_DATABASE_HOST,
  port     : process.env.MDL_DATABASE_PORT,
  user     : process.env.MDL_DATABASE_USER,
  password : process.env.MDL_DATABASE_PASSWORD,
  database : process.env.MDL_DATABASE_NAME,
  connectionLimit: 10,
};

(async () => {
  const mdl_pool = mysql.createPool(mdl_connection_config);

  const teachers = await mdl_common.get_teachers(mdl_pool);
  for (const t of teachers) {
    const courses = await mdl_common.get_courses(mdl_pool, t.id);

    for (const course of courses) {
      const ctx = await mdl_common.get_course_context(mdl_pool, course.id);
      if (!ctx) {
        console.log(`Could not find context for course: ${course.id} ${course.fullname}`);
        continue;
      }

      const blocks = await mdl_common.get_context_blocks(mdl_pool, ctx.id);
      if (blocks.length > 0) continue;

      console.log(`Creatig blocks for ${course.id} ${course.fullname}`);
      await mdl_common.create_default_blocks(mdl_pool, ctx.id);
    } 
  }

  await mdl_pool.end();
})();