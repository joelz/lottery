import "./index.css";
import "../css/animate.min.css";
import "./canvas.js";
import {
  addQipao,
  setPrizes,
  showPrizeList,
  setPrizeData,
  resetPrize
} from "./prizeList";
import { NUMBER_MATRIX } from "./config.js";

const ROTATE_TIME = 3000;
const ROTATE_LOOP = 1000;
const BASE_HEIGHT = 1080;

let TOTAL_CARDS,
  btns = {
    enter: document.querySelector("#enter"),
    lotteryBar: document.querySelector("#lotteryBar"),
    lottery: document.querySelector("#lottery")
  },
  redraw = {
    modal: document.querySelector("#redrawModal"),
    input: document.querySelector("#redrawCountInput"),
    confirm: document.querySelector("#redrawConfirm"),
    cancel: document.querySelector("#redrawCancel"),
    error: document.querySelector("#redrawError")
  },
  prizes,
  EACH_COUNT,
  ROW_COUNT = 7,
  COLUMN_COUNT = 17,
  HIGHLIGHT_CELL = [],
  // 当前的比例
  Resolution = 1;

let camera,
  scene,
  renderer,
  controls,
  threeDCards = [],
  targets = {
    table: [],
    sphere: []
  };

let rotateObj;

let selectedCardIndex = [],
  rotate = false,
  isRedrawOpen = false,
  basicData = {
    prizes: [], //奖品信息
    users: [], //所有人员
    luckyUsers: {}, //已中奖人员
    leftUsers: [], //未中奖人员
    excludeByPrize: {} // 各奖项排除名单
  },
  interval,
  // 当前抽的奖项，从最低奖开始抽，直到抽到大奖
  currentPrizeIndex,
  currentPrize,
  // 正在抽奖
  isLotting = false,
  currentLuckys = [];

initAll();

/**
 * 初始化所有DOM
 */
function initAll() {
  window.AJAX({
    url: "/getTempData",
    success(data) {
      // 获取基础数据
      prizes = data.cfgData.prizes;
      EACH_COUNT = data.cfgData.EACH_COUNT;
      HIGHLIGHT_CELL = createHighlight();
      basicData.prizes = prizes;
      setPrizes(prizes);

      TOTAL_CARDS = ROW_COUNT * COLUMN_COUNT;

      // 读取当前已设置的抽奖结果
      basicData.leftUsers = data.leftUsers || [];
      basicData.luckyUsers = data.luckyData;
      basicData.excludeByPrize = prepareExcludeMap(
        data.excludeByPrize ||
          (data.cfgData && data.cfgData.PRIZE_EXCLUDES) ||
          {}
      );

      // data.luckyData 的类型是 object，key 是奖项的 type，value 是获奖人员列表
      console.log(basicData.prizes, data.luckyData)
      let prizeIndex = basicData.prizes.length - 1;
      for (; prizeIndex > -1; prizeIndex--) {
        const prizeType = basicData.prizes[prizeIndex].type;

        if (
          data.luckyData[prizeType] &&
          data.luckyData[prizeType].length >=
            basicData.prizes[prizeIndex].count
        ) {
          continue;
        }
        currentPrizeIndex = prizeIndex;
        currentPrize = basicData.prizes[currentPrizeIndex];
        break;
      }

      showPrizeList(currentPrizeIndex);
      let curLucks = basicData.luckyUsers[currentPrize.type];
      setPrizeData(currentPrizeIndex, curLucks ? curLucks.length : 0, true);
    }
  });

  window.AJAX({
    url: "/getUsers",
    success(data) {
      basicData.users = data;
      if (basicData.leftUsers.length === 0) {
        basicData.leftUsers = basicData.users.slice();
      }

      initCards();
      // startMaoPao();
      animate();
      shineCard();
    }
  });
}

function initCards() {
  let member = basicData.users.slice(),
    showCards = [],
    length = member.length;

  let isBold = false,
    showTable = basicData.leftUsers.length === basicData.users.length,
    index = 0,
    totalMember = member.length,
    position = {
      x: (140 * COLUMN_COUNT - 20) / 2,
      y: (180 * ROW_COUNT - 20) / 2
    };

  camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  camera.position.z = 3000;

  scene = new THREE.Scene();

  for (let i = 0; i < ROW_COUNT; i++) {
    for (let j = 0; j < COLUMN_COUNT; j++) {
      isBold = HIGHLIGHT_CELL.includes(j + "-" + i);
      var element = createCard(
        member[index % length],
        isBold,
        index,
        showTable
      );

      var object = new THREE.CSS3DObject(element);
      object.position.x = Math.random() * 4000 - 2000;
      object.position.y = Math.random() * 4000 - 2000;
      object.position.z = Math.random() * 4000 - 2000;
      scene.add(object);
      threeDCards.push(object);
      //

      var object = new THREE.Object3D();
      object.position.x = j * 140 - position.x;
      object.position.y = -(i * 180) + position.y;
      targets.table.push(object);
      index++;
    }
  }

  // sphere

  var vector = new THREE.Vector3();

  for (var i = 0, l = threeDCards.length; i < l; i++) {
    var phi = Math.acos(-1 + (2 * i) / l);
    var theta = Math.sqrt(l * Math.PI) * phi;
    var object = new THREE.Object3D();
    object.position.setFromSphericalCoords(800 * Resolution, phi, theta);
    vector.copy(object.position).multiplyScalar(2);
    object.lookAt(vector);
    targets.sphere.push(object);
  }

  renderer = new THREE.CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("container").appendChild(renderer.domElement);

  //

  controls = new THREE.TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = 0.5;
  controls.minDistance = 500;
  controls.maxDistance = 6000;
  controls.addEventListener("change", render);

  bindEvent();

  if (showTable) {
    switchScreen("enter");
  } else {
    switchScreen("lottery");
  }
}

function setLotteryStatus(status = false) {
  isLotting = status;
}

function getCurrentLuckyCount() {
  if (!currentPrize) {
    return 0;
  }
  let list = basicData.luckyUsers[currentPrize.type] || [];
  return list.length;
}

function isCurrentPrizeCompleted() {
  if (!currentPrize) {
    return false;
  }
  console.log(getCurrentLuckyCount())
  return getCurrentLuckyCount() >= currentPrize.count;
}

function toggleRedrawModal(show) {
  if (!redraw.modal) {
    return;
  }
  isRedrawOpen = !!show;
  redraw.modal.classList[show ? "remove" : "add"]("none");
  if (show) {
    redraw.input.value = "";
    redraw.error.textContent = "";
    redraw.input.focus();
  }
}

function openRedrawPrompt() {
  if (isLotting) {
    addQipao("正在抽奖，请稍后再补抽。");
    return;
  }
  if (!currentPrize) {
    return;
  }
  // if (!isCurrentPrizeCompleted()) {
  //   addQipao("当前奖项未抽完，暂不能补抽。");
  //   return;
  // }
  toggleRedrawModal(true);
}

function handleRedrawSubmit() {
  if (!currentPrize) {
    return;
  }
  let value = Number(redraw.input.value);
  if (!Number.isFinite(value) || value <= 0) {
    redraw.error.textContent = "请输入大于0的数量";
    redraw.input.focus();
    return;
  }
  if (value > basicData.leftUsers.length) {
    redraw.error.textContent = "剩余未中奖人数不足";
    redraw.input.focus();
    return;
  }

  currentPrize.count += value;
  basicData.prizes[currentPrizeIndex].count = currentPrize.count;

  let luckyCount = getCurrentLuckyCount();
  setPrizeData(currentPrizeIndex, luckyCount, false, value);

  btns.lottery.innerHTML = "开始抽奖";
  document.querySelector("#reLottery").style.display = "inline-block";

  addQipao(`已为[${currentPrize.title}]追加 ${value} 个名额，继续抽取吧。`);
  toggleRedrawModal(false);
}

function bindRedrawEvent() {
  if (!redraw.modal) {
    return;
  }

  redraw.confirm &&
    redraw.confirm.addEventListener("click", () => {
      handleRedrawSubmit();
    });

  redraw.cancel &&
    redraw.cancel.addEventListener("click", () => {
      toggleRedrawModal(false);
    });

  redraw.input &&
    redraw.input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        handleRedrawSubmit();
      }
      if (e.key === "Escape") {
        toggleRedrawModal(false);
      }
    });

  window.addEventListener("keydown", e => {
    if (isRedrawOpen && e.key === "Escape") {
      toggleRedrawModal(false);
      return;
    }
    if (e.code === "KeyR" && e.shiftKey && !isRedrawOpen) {
      e.preventDefault();
      openRedrawPrompt();
    }
  });
}

/**
 * 事件绑定
 */
function bindEvent() {
  document.querySelector("#menu").addEventListener("click", function (e) {
    e.stopPropagation();
    // 如果正在抽奖，则禁止一切操作
    if (isLotting) {
      if (e.target.id === "lottery") {
        rotateObj.stop();
        setTimeout(() => {
          // console.log(currentPrize.count, currentLuckys.length, basicData.luckyUsers[currentPrize.type].length);
          if (currentPrize && currentPrize.count <= (basicData.luckyUsers[currentPrize.type].length + currentLuckys.length)) {
            btns.lottery.innerHTML = "准备抽取下一奖项";
          } else {
            btns.lottery.innerHTML = "开始抽奖";
          }
        }, 500);
      } else {
        addQipao("正在抽奖，抽慢一点点～～");
      }
      return false;
    }

    let target = e.target.id;
    switch (target) {
      // 显示数字墙
      case "welcome":
        switchScreen("enter");
        rotate = false;
        break;
      // 进入抽奖
      case "enter":
        removeHighlight();
        addQipao(`马上抽取[${currentPrize.title}],不要走开。`);
        // rotate = !rotate;
        rotate = true;
        switchScreen("lottery");
        break;
      // 重置
      case "reset":
        let doREset = window.confirm(
          "是否确认重置数据，重置后，当前已抽的奖项全部清空？"
        );
        if (!doREset) {
          return;
        }
        addQipao("重置所有数据，重新抽奖");
        addHighlight();
        resetCard();
        // 重置所有数据
        currentLuckys = [];
        basicData.leftUsers = Object.assign([], basicData.users);
        basicData.luckyUsers = {};
        currentPrizeIndex = basicData.prizes.length - 1;
        currentPrize = basicData.prizes[currentPrizeIndex];

        resetPrize(currentPrizeIndex);
        reset();
        switchScreen("enter");
        break;
      // 抽奖
      case "lottery":
        if (e.target.innerHTML === "准备抽取下一奖项") {
          // 每次抽奖前先保存上一次的抽奖数据
          saveData().then(res => {
            resetCard().then(res => {
              // 将之前的记录置空
              currentLuckys = [];

              changePrize(true);
              e.target.innerHTML = '开始抽奖';
              document.querySelector('#reLottery').style.display = 'none';
            });
            addQipao(`准备抽取下一奖项`);
          });
          return;
        }
        setLotteryStatus(true);
        // 每次抽奖前先保存上一次的抽奖数据
        saveData();
        //更新剩余抽奖数目的数据显示
        changePrize();
        document.querySelector('#reLottery').style.display = 'inline-block';
        resetCard().then(res => {
          // 抽奖
          lottery();
        });
        addQipao(`正在抽取[${currentPrize.title}],调整好姿势`);
        break;
      // 重新抽奖
      case "reLottery":
        if (currentLuckys.length === 0) {
          addQipao(`当前还没有抽奖，无法重新抽取喔~~`);
          return;
        }
        setErrorData(currentLuckys);
        addQipao(`重新抽取[${currentPrize.title}],做好准备`);
        setLotteryStatus(true);
        // 重新抽奖则直接进行抽取，不对上一次的抽奖数据进行保存
        // 抽奖
        resetCard().then(res => {
          // 抽奖
          lottery();
        });
        break;
      // 导出抽奖结果
      case "save":
        saveData().then(res => {
          resetCard().then(res => {
            // 将之前的记录置空
            currentLuckys = [];
          });
          exportData();
          addQipao(`数据已保存到EXCEL中。`);
        });
        break;
    }
  });

  window.addEventListener("resize", onWindowResize, false);

  bindRedrawEvent();
}

function switchScreen(type) {
  switch (type) {
    case "enter":
      btns.enter.classList.remove("none");
      btns.lotteryBar.classList.add("none");
      transform(targets.table, 2000);
      break;
    default:
      btns.enter.classList.add("none");
      btns.lotteryBar.classList.remove("none");
      transform(targets.sphere, 2000);
      break;
  }
}

/**
 * 创建元素
 */
function createElement(css, text) {
  let dom = document.createElement("div");
  dom.className = css || "";
  dom.innerHTML = text || "";
  return dom;
}

/**
 * 创建名牌
 */
function createCard(user, isBold, id, showTable) {
  var element = createElement();
  element.id = "card-" + id;

  if (isBold) {
    element.className = "element lightitem";
    if (showTable) {
      element.classList.add("highlight");
    }
  } else {
    element.className = "element";
    element.style.backgroundColor =
      "rgba(0,127,127," + (Math.random() * 0.7 + 0.25) + ")";
  }
  //添加公司标识
  element.appendChild(createElement("company", user[3] || ""));

  element.appendChild(createElement("name", user[1]));

  element.appendChild(createElement("details", ""));
  // element.appendChild(createElement("details", user[0] + "<br/>" + user[2]));
  return element;
}

function removeHighlight() {
  document.querySelectorAll(".highlight").forEach(node => {
    node.classList.remove("highlight");
  });
}

function addHighlight() {
  document.querySelectorAll(".lightitem").forEach(node => {
    node.classList.add("highlight");
  });
}

/**
 * 渲染地球等
 */
function transform(targets, duration) {
  // TWEEN.removeAll();
  for (var i = 0; i < threeDCards.length; i++) {
    var object = threeDCards[i];
    var target = targets[i];

    new TWEEN.Tween(object.position)
      .to(
        {
          x: target.position.x,
          y: target.position.y,
          z: target.position.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to(
        {
          x: target.rotation.x,
          y: target.rotation.y,
          z: target.rotation.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  }

  new TWEEN.Tween(this)
    .to({}, duration * 2)
    .onUpdate(render)
    .start();
}

// function rotateBall() {
//   return new Promise((resolve, reject) => {
//     scene.rotation.y = 0;
//     new TWEEN.Tween(scene.rotation)
//       .to(
//         {
//           y: Math.PI * 8
//         },
//         ROTATE_TIME
//       )
//       .onUpdate(render)
//       .easing(TWEEN.Easing.Exponential.InOut)
//       .start()
//       .onComplete(() => {
//         resolve();
//       });
//   });
// }

function rotateBall() {
  return new Promise((resolve, reject) => {
    scene.rotation.y = 0;
    rotateObj = new TWEEN.Tween(scene.rotation);
    rotateObj
      .to(
        {
          y: Math.PI * 6 * ROTATE_LOOP
        },
        ROTATE_TIME * ROTATE_LOOP
      )
      .onUpdate(render)
      // .easing(TWEEN.Easing.Linear)
      .start()
      .onStop(() => {
        scene.rotation.y = 0;
        resolve();
      })
      .onComplete(() => {
        resolve();
      });
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

function animate() {
  // 让场景通过x轴或者y轴旋转
  // rotate && (scene.rotation.y += 0.088);

  requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();

  // 渲染循环
  // render();
}

function render() {
  renderer.render(scene, camera);
}

function selectCard(duration = 600) {
  rotate = false;
  let width = 140,
    height = 80,
    locates = [];

  // Calculate rows and positions
  let rows = Math.ceil(currentLuckys.length / 5);
  let totalHeight = (rows - 1) * height;
  
  // Calculate starting Y position to center vertically
  let startY = totalHeight / 2;

  // Generate position for each card, 5 per row
  for (let i = 0; i < currentLuckys.length; i++) {
    let row = Math.floor(i / 5);
    let col = i % 5;
    
    // Calculate cards in current row
    let cardsInThisRow = (row === Math.floor((currentLuckys.length - 1) / 5)) 
      ? ((currentLuckys.length - 1) % 5) + 1 
      : 5;
    
    // Center cards in current row
    let startX = ((cardsInThisRow - 1) / 2) * width;
    
    locates.push({
      x: (col * width - startX) * Resolution,
      y: (startY - row * height) * Resolution
    });
  }

  let text = currentLuckys.map(item => item[1]);
  addQipao(
    `恭喜${text.join("、")}获得${currentPrize.title}, 新的一年必定旺旺旺。`
  );

  selectedCardIndex.forEach((cardIndex, index) => {
    changeCard(cardIndex, currentLuckys[index]);
    var object = threeDCards[cardIndex];
    new TWEEN.Tween(object.position)
      .to(
        {
          x: locates[index].x,
          y: locates[index].y,
          z: 2200
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to(
        {
          x: 0,
          y: 0,
          z: 0
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    object.element.classList.add("prize");
  });

  new TWEEN.Tween(this)
    .to({}, duration * 2)
    .onUpdate(render)
    .start()
    .onComplete(() => {
      setLotteryStatus();
    });
}

/**
 * 重置抽奖牌内容
 */
function resetCard(duration = 500) {
  if (currentLuckys.length === 0) {
    return Promise.resolve();
  }

  selectedCardIndex.forEach(index => {
    let object = threeDCards[index],
      target = targets.sphere[index];

    new TWEEN.Tween(object.position)
      .to(
        {
          x: target.position.x,
          y: target.position.y,
          z: target.position.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to(
        {
          x: target.rotation.x,
          y: target.rotation.y,
          z: target.rotation.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  });

  return new Promise((resolve, reject) => {
    new TWEEN.Tween(this)
      .to({}, duration * 2)
      .onUpdate(render)
      .start()
      .onComplete(() => {
        selectedCardIndex.forEach(index => {
          let object = threeDCards[index];
          object.element.classList.remove("prize");
        });
        resolve();
      });
  });
}

/**
 * 抽奖
 */
function lottery() {
  btns.lottery.innerHTML = "结束抽奖";
  rotateBall().then(() => {
    // 将之前的记录置空
    currentLuckys = [];
    selectedCardIndex = [];
    
    // 获取当前奖项剩余数量
    let luckyData = basicData.luckyUsers[currentPrize.type];
    let leftPrizeCount = currentPrize.count - (luckyData ? luckyData.length : 0);

    // 确定本次抽取数量
    let perCount;
    if (leftPrizeCount <= 25) {
      // 如果剩余奖项小于等于25个，一次抽完
      perCount = leftPrizeCount;
    } else {
      // 如果剩余奖项大于25个，每次抽25个
      perCount = 25;
    }

    let eligiblePool = buildEligiblePool(currentPrize.type, {
      includeIndex: true
    });

    console.log('pool', eligiblePool.map(item => item.user[0]).sort());

    if (eligiblePool.length < perCount) {
      addQipao("剩余参与抽奖人员不足，现在重新设置所有人员可以进行二次抽奖！");
      basicData.leftUsers = basicData.users.slice();
      eligiblePool = buildEligiblePool(currentPrize.type, {
        includeIndex: true
      });
    }

    if (eligiblePool.length === 0) {
      addQipao(
        `当前奖项[${currentPrize.title}]没有可参与人员，请检查排除名单。`
      );
      btns.lottery.innerHTML = "开始抽奖";
      setLotteryStatus();
      return;
    }

    if (eligiblePool.length < perCount) {
      addQipao("当前奖项可参与人数少于计划抽取数量，将全部抽完。");
      perCount = eligiblePool.length;
    }

    let usedLeftIndexes = [];

    for (let i = 0; i < perCount; i++) {
      let luckyIdx = random(eligiblePool.length);
      let pick = eligiblePool.splice(luckyIdx, 1)[0];
      currentLuckys.push(pick.user);
      usedLeftIndexes.push(pick.leftIndex);

      let cardIndex = random(TOTAL_CARDS);
      while (selectedCardIndex.includes(cardIndex)) {
        cardIndex = random(TOTAL_CARDS);
      }
      selectedCardIndex.push(cardIndex);
    }

    usedLeftIndexes
      .sort((a, b) => b - a)
      .forEach(index => {
        basicData.leftUsers.splice(index, 1);
      });

    console.log('leftUsers', basicData.leftUsers.map(item => item[0]).sort());
    selectCard();
  });
}

/**
 * 保存上一次的抽奖结果
 */
function saveData() {
  if (!currentPrize) {
    //若奖品抽完，则不再记录数据，但是还是可以进行抽奖
    return;
  }

  let type = currentPrize.type,
    curLucky = basicData.luckyUsers[type] || [];

  curLucky = curLucky.concat(currentLuckys);

  basicData.luckyUsers[type] = curLucky;

  if (currentPrize.count <= curLucky.length) {
    currentPrizeIndex--;
    if (currentPrizeIndex <= -1) {
      currentPrizeIndex = 0;
    }
    currentPrize = basicData.prizes[currentPrizeIndex];
  }

  if (currentLuckys.length > 0) {
    // todo by xc 添加数据保存机制，以免服务器挂掉数据丢失
    return setData(type, currentLuckys);
  }
  return Promise.resolve();
}

function changePrize(isInit = false) {
  let luckys = basicData.luckyUsers[currentPrize.type];
  let leftPrizeCount = currentPrize.count - (luckys ? luckys.length : 0);
  let luckyCount;

  // 初始化时，本次抽奖数目为0
  if (isInit) {
    luckyCount = 0;
  } else {
    // 确定本次抽取数量
    if (leftPrizeCount <= 25) {
      // 如果剩余奖项小于等于25个，一次抽完
      luckyCount = (luckys ? luckys.length : 0) + leftPrizeCount;
    } else {
      // 如果剩余奖项大于25个，每次抽25个
      luckyCount = (luckys ? luckys.length : 0) + 25;
    }
  }

  // 修改左侧prize的数目和百分比
  setPrizeData(currentPrizeIndex, luckyCount);
}

/**
 * 随机抽奖
 */
function random(num) {
  // Math.floor取到0-num-1之间数字的概率是相等的
  return Math.floor(Math.random() * num);
}

function prepareExcludeMap(source = {}) {
  let map = {};
  if (!source) {
    return map;
  }
  Object.keys(source).forEach(key => {
    let list = source[key];
    if (!Array.isArray(list)) {
      return;
    }
    map[key] = new Set(list.map(item => String(item)));
  });
  return map;
}

function getUserUniqueId(user) {
  if (!user) {
    return undefined;
  }
  if (Array.isArray(user)) {
    return user[0];
  }
  if (typeof user === "object") {
    return (
      user.userId ||
      user.id ||
      user.employeeId ||
      user.code ||
      user.workId ||
      user[0]
    );
  }
  return user;
}

function isUserExcluded(prizeType, user) {
  let excludeSet = basicData.excludeByPrize[prizeType];
  if (!excludeSet || excludeSet.size === 0) {
    return false;
  }
  let uid = getUserUniqueId(user);
  if (uid === undefined || uid === null) {
    return false;
  }
  return excludeSet.has(String(uid));
}

function buildEligiblePool(prizeType, options = {}) {
  let includeIndex = !!options.includeIndex;
  let pool = [];
  let list = basicData.leftUsers || [];
  list.forEach((user, index) => {
    if (isUserExcluded(prizeType, user)) {
      return;
    }
    pool.push(includeIndex ? { user, leftIndex: index } : user);
  });
  return pool;
}

/**
 * 切换名牌人员信息
 */
function changeCard(cardIndex, user) {
  let card = threeDCards[cardIndex].element;
  
  card.innerHTML = `<div class="company">${user[3] || ""}</div>
                   <div class="name">${user[1]}</div>
                   <div class="details"></div>`;
}

/**
 * 切换名牌背景
 */
function shine(cardIndex, color) {
  let card = threeDCards[cardIndex].element;
  card.style.backgroundColor =
    color || "rgba(0,127,127," + (Math.random() * 0.7 + 0.25) + ")";
}

/**
 * 随机切换背景和人员信息
 */
function shineCard() {
  let maxCard = 10,
    maxUser;
  let shineCard = 10 + random(maxCard);

  setInterval(() => {
    // 正在抽奖停止闪烁
    if (isLotting) {
      return;
    }
    maxUser = basicData.leftUsers.length;
    for (let i = 0; i < shineCard; i++) {
      let index = random(maxUser),
        cardIndex = random(TOTAL_CARDS);
      // 当前显示的已抽中名单不进行随机切换
      if (selectedCardIndex.includes(cardIndex)) {
        continue;
      }
      shine(cardIndex);
      changeCard(cardIndex, basicData.leftUsers[index]);
    }
  }, 500);
}

function setData(type, data) {
  return new Promise((resolve, reject) => {
    window.AJAX({
      url: "/saveData",
      data: {
        type,
        data
      },
      success() {
        resolve();
      },
      error() {
        reject();
      }
    });
  });
}

function setErrorData(data) {
  return new Promise((resolve, reject) => {
    window.AJAX({
      url: "/errorData",
      data: {
        data
      },
      success() {
        resolve();
      },
      error() {
        reject();
      }
    });
  });
}

function exportData() {
  window.AJAX({
    url: "/export",
    success(data) {
      if (data.type === "success") {
        location.href = data.url;
      }
    }
  });
}

function reset() {
  window.AJAX({
    url: "/reset",
    success(data) {
      console.log("重置成功");
    }
  });
}

function createHighlight() {
  let year = new Date().getFullYear() + "";
  let step = 4,
    xoffset = 1,
    yoffset = 1,
    highlight = [];

  year.split("").forEach(n => {
    highlight = highlight.concat(
      NUMBER_MATRIX[n].map(item => {
        return `${item[0] + xoffset}-${item[1] + yoffset}`;
      })
    );
    xoffset += step;
  });

  return highlight;
}

let onload = window.onload;

window.onload = function () {
  onload && onload();

  let music = document.querySelector("#music");

  let rotated = 0,
    stopAnimate = false,
    musicBox = document.querySelector("#musicBox");

  function animate() {
    requestAnimationFrame(function () {
      if (stopAnimate) {
        return;
      }
      rotated = rotated % 360;
      musicBox.style.transform = "rotate(" + rotated + "deg)";
      rotated += 1;
      animate();
    });
  }

  musicBox.addEventListener(
    "click",
    function (e) {
      if (music.paused) {
        music.play().then(
          () => {
            stopAnimate = false;
            animate();
          },
          () => {
            addQipao("背景音乐自动播放失败，请手动播放！");
          }
        );
      } else {
        music.pause();
        stopAnimate = true;
      }
    },
    false
  );

  setTimeout(function () {
    // musicBox.click();
  }, 1000);
};
