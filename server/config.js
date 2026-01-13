/**
 * 奖品设置
 * type: 唯一标识，0是默认特别奖的占位符，其它奖品不可使用
 * count: 奖品数量
 * title: 奖品描述
 * text: 奖品标题
 * img: 图片地址
 */
const prizes = [
  {
    type: 0,
    count: 2,
    title: "",
    text: "特别奖"
  },
  {
    type: 1,
    count: 1,
    text: "特等奖",
    title: "",
    img: ["../img/mbp.jpg"]
  },
  {
    type: 2,
    count: 5,
    text: "一等奖",
    title: "",
    img: ["../img/huawei.png", "../img/huawei.png", "../img/huawei.png", "../img/huawei.png"]
  },
  {
    type: 3,
    count: 15,
    text: "二等奖",
    title: "",
    img: ["../img/ipad.jpg", "../img/ipad.jpg", "../img/ipad.jpg", "../img/ipad.jpg"]
  },
  {
    type: 4,
    count: 20,
    text: "三等奖",
    title: "",
    img: ["../img/spark.jpg", "../img/spark.jpg", "../img/spark.jpg", "../img/spark.jpg"]
  },
];

/**
 * 一次抽取的奖品个数与prizes对应
 */
const EACH_COUNT = [1, 1, 5, 6, 7, 8];

/**
 * 指定奖项需要排除的人员（按工号/唯一 ID）列表
 * key 对应 prize.type，value 为数组
 */
const PRIZE_EXCLUDES = {
  // 例如：1: ["10001", "10002"]
  // 1: ["000002", "000004", "000006", "000005"],
  // 2: ["000002", "000003", "000007"],
  // 3: ["000002"],
  // 4: ["000002"],
};

module.exports = {
  prizes,
  EACH_COUNT,
  PRIZE_EXCLUDES
};
