const common = require("./common");

const date1 = "2023.11.25 23:55:00";
const date2 = "2022.11.25 23:55:00";
const time1 = common.make_unix_timestamp(date1);
const time2 = common.make_unix_timestamp(date2);

console.log(`${date1} ${time1}`);
console.log(`${date2} ${time2}`);