// 캔버스 및 컨텍스트 설정
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// HTML 오버레이 요소 가져오기
const overlay = document.getElementById("gameStatusOverlay");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const restartButton = document.getElementById("restartButton"); 

// --- 사운드 효과 ---
const bounceSound = document.getElementById("bounceSound");
const hitSound = document.getElementById("hitSound");
const brickSound = document.getElementById("brickSound");
const itemSound = document.getElementById("itemSound");
const laserSound = document.getElementById("laserSound");
const dropSound = document.getElementById("dropSound");
const openingSound = document.getElementById("openingSound");
const overSound = document.getElementById("overSound");
const roundSound = document.getElementById("roundSound");
const cleardSound = document.getElementById("cleardSound");

// 프레임에 따라 공 속도 달라져 프레임 고정
let lastTime = 0;
const fixedDelta = 1000 / 60; // 60fps 기준 고정 간격

function gameLoop(timestamp) {
  const delta = timestamp - lastTime;
  if (delta >= fixedDelta) {
    updateGame(fixedDelta / 1000); // 초 단위
    renderGame();
    lastTime = timestamp;
  }
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);




function playSound(sound) {
    if (!sound) return; // 혹시 undefined일 때 에러 방지
    try {
        sound.currentTime = 0;
        sound.play();
    } catch (e) {
        console.warn("Sound playback error:", e);
    }
}

// --- 스테이지 관리 ---
let currentStage = 1;
const maxStage = 3;
let isTransitioning = false; // 스테이지 전환 중인지 여부



// --- 게임 상태 관리 ---
const GAME_STATE = {
    INTRO: 'INTRO',
    PLAYING: 'PLAYING',
    GAMEOVER: 'GAMEOVER',
    WIN: 'WIN'
};
let currentState = GAME_STATE.INTRO; 


// --- 공 관리 시스템 ---
const ballRadius = 10;
let baseSpeed = 3; 
let balls = []; 
let ballOnPaddle = true; 


function createBall() {
    return {
        x: canvas.width / 2,
        y: canvas.height - 30 - ballRadius, 
        dx: baseSpeed * (Math.random() > 0.5 ? 1 : -1), 
        dy: -baseSpeed,
        radius: ballRadius
    };
}
balls.push(createBall()); 

// 패들 설정
const initialPaddleWidth = 75; 
const paddleHeight = 10;
let paddleWidth = initialPaddleWidth;
let paddleX = (canvas.width - paddleWidth) / 2;

// ⬇️ 패들 기본 속도 정의 추가
const basePaddleSpeed = 7; 


// 사용자 입력 (키보드)
let rightPressed = false;
let leftPressed = false;
let spacePressed = false; 

// 🧱 벽돌 설정 (수정됨)
const brickRowCount = 6;     // 6행으로 증가
const brickColumnCount = 10; // 10열로 증가
const brickWidth = 50;       // 너비를 50으로 조정
const brickHeight = 20;
const brickPadding = 5;
const brickOffsetTop = 30;
const brickOffsetLeft = 5;   // 왼쪽 여백을 5로 조정
let bricks = [];
let totalBricks = brickRowCount * brickColumnCount; // 총 60개

// 벽돌 내구도 및 색상 맵
const brickColorMap = {
    1: "#FF5733", 
    2: "#FFC300", 
    3: "#C70039",
    4: "#800000",
    5: "#4B0000"   
};

// 251105 스테이지 생성을 위한 코드 수정
const maxHealth = 5;
let useCustomHealth = false; // 기본값 : false, 테스트용 스테이지 블록 내구도 조절을 위한 코드
//let useCustomHealth = true; // 테스트용 : true
// 게임 시작 시 바로 레이저 가능하도록


function initializeBricks() {
    bricks = [];
    const dynamicMaxHealth = useCustomHealth ? maxHealth : Math.min(2 + currentStage, 5);
    for (let c = 0; c < brickColumnCount; c++) {
        bricks[c] = [];
        for (let r = 0; r < brickRowCount; r++) {
            const health = Math.floor(Math.random() * dynamicMaxHealth) + 1;
            bricks[c][r] = { x: 0, y: 0, status: 1, health: health, maxHealth: health };
        }
    }
}
//function initializeBricks() {
//     bricks = []; 
//     for(let c = 0; c < brickColumnCount; c++) {
//         bricks[c] = [];
//         for(let r = 0; r < brickRowCount; r++) {
//             const health = (r % maxHealth) + 1; 
//             bricks[c][r] = { x: 0, y: 0, status: 1, health: health, maxHealth: health };
//         }
//     }
// }
initializeBricks(); 

// 점수 및 생명 설정
let score = 0;
let bricksBroken = 0; 
let lives = 5; 

// 폭발 파티클 관리
let particles = [];

// --- 아이템 시스템 ---
let items = [];
const ITEM_WIDTH = 15;
const ITEM_HEIGHT = 15;
const ITEM_SPEED = 2;
const PADDLE_GROW_DURATION = 5000;
const LASER_DURATION = 7000;
const SPEED_UP_DURATION = 4000;
const SPEED_BOOST_FACTOR = 1.5; 

// ⬇️ 디버프 관련 상수 추가 
const PADDLE_SHRINK_DURATION = 4000; // 4초
const PADDLE_SLOW_DURATION = 5000; // 5초
const PADDLE_SLOW_FACTOR = 0.5; // 패들 이동 속도를 절반으로


const itemTypes = [
    { type: "PADDLE_GROW", color: "green", duration: PADDLE_GROW_DURATION, value: 40, symbol: 'W' },
    { type: "LASER_SHOT", color: "red", duration: LASER_DURATION, value: 0, symbol: 'L' }, 
    { type: "SPEED_UP", color: "blue", duration: SPEED_UP_DURATION, value: SPEED_BOOST_FACTOR, symbol: 'M' },
    
    // ⬇️ 디버프 아이템 추가
    { type: "PADDLE_SHRINK", color: "orange", duration: PADDLE_SHRINK_DURATION, value: 30, symbol: 'S' }, // 30만큼 감소
    { type: "PADDLE_SLOW", color: "yellow", duration: PADDLE_SLOW_DURATION, value: PADDLE_SLOW_FACTOR, symbol: 'P' }
];

function Item(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.color = type.color;
    this.width = ITEM_WIDTH;
    this.height = ITEM_HEIGHT;
}

let paddleGrowTimer = null;
let laserActiveTimer = null; 
let speedUpTimer = null; 
// ⬇️ 디버프 타이머 추가
let paddleShrinkTimer = null; 
let paddleSlowTimer = null; 

// --- 레이저 시스템 ---
function Laser(x, y) {
    this.x = x;
    this.y = y;
    this.width = LASER_WIDTH;
    this.height = LASER_HEIGHT;
    this.color = "#FF6347";
}
let lasers = [];
const LASER_WIDTH = 3;
const LASER_HEIGHT = 10;
const LASER_SPEED = 5;

// 파티클 객체 생성자
function Particle(x, y, color, size, velocityX, velocityY, decay) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.alpha = 1; 
    this.decay = decay; 
}

Particle.prototype.update = function() {
    this.x += this.velocityX;
    this.y += this.velocityY;
    this.alpha -= this.decay;
    
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
}

function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }
}

// --- 드로잉 함수 ---

function drawBalls() {
    for (const ball of balls) { 
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#0095DD"; 
        ctx.fill();
        ctx.closePath();
    }
}

function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddleX, canvas.height - paddleHeight, paddleWidth, paddleHeight);
    let paddleColor = "#0095DD";
    if (paddleGrowTimer) paddleColor = "#4CAF50"; 
    if (laserActiveTimer) paddleColor = "#FF6347"; 
    // ⬇️ 디버프 효과에 따른 패들 색상 변화 추가
    if (paddleShrinkTimer) paddleColor = "#FF8C00"; // 주황 (PADDLE_SHRINK)
    if (paddleSlowTimer) paddleColor = "#FFFF00"; // 노랑 (PADDLE_SLOW)
    
    ctx.fillStyle = paddleColor;
    ctx.fill();
    ctx.closePath();
}

function drawBricks() {
    for(let c = 0; c < brickColumnCount; c++) {
        for(let r = 0; r < brickRowCount; r++) {
            const brick = bricks[c][r];
            if(brick.status === 1) {
                const brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
                const brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
                
                brick.x = brickX;
                brick.y = brickY;
                
                ctx.beginPath();
                ctx.rect(brickX, brickY, brickWidth, brickHeight);
                ctx.fillStyle = brickColorMap[brick.health]; 
                ctx.fill();
                ctx.closePath();
            }
        }
    }
}

function drawItems() {
    for(let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += ITEM_SPEED; 

        ctx.beginPath();
        ctx.rect(item.x, item.y, item.width, item.height);
        ctx.fillStyle = item.color;
        ctx.fill();
        
        ctx.font = "12px Arial";
        ctx.fillStyle = "white";
        ctx.fillText(item.type.symbol, item.x + 3, item.y + 12);
        ctx.closePath();
        
        if (item.y > canvas.height) {
            items.splice(i, 1);
        }
    }
}

function drawLasers() {
    for(let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];
        laser.y -= LASER_SPEED; 

        ctx.beginPath();
        ctx.rect(laser.x, laser.y, laser.width, laser.height);
        ctx.fillStyle = laser.color;
        ctx.fill();
        ctx.closePath();
        
        if (laser.y < 0) {
            lasers.splice(i, 1);
        }
    }
}

function drawScore() {
    ctx.font = "16px Arial";
    
    ctx.fillStyle = "#0095DD";
    ctx.textAlign = "left"; 
    ctx.fillText("점수: " + score, 8, 20);
    
    ctx.fillStyle = "#0095DD";
    ctx.textAlign = "right"; 
    ctx.fillText("생명: " + lives, canvas.width - 8, 20); 
    
    let effectText = "";
    if (paddleGrowTimer) {
        const remainingTime = Math.ceil((paddleGrowTimer.endTime - Date.now()) / 1000);
        effectText += `W UP: ${remainingTime}s `;
    }
    if (laserActiveTimer) {
        const remainingTime = Math.ceil((laserActiveTimer.endTime - Date.now()) / 1000);
        effectText += `LASER: ${remainingTime}s `;
    }
    if (speedUpTimer) { 
        const remainingTime = Math.ceil((speedUpTimer.endTime - Date.now()) / 1000);
        effectText += `S UP: ${remainingTime}s `;
    }

    // ⬇️ 디버프 상태 표시 추가 
    if (paddleShrinkTimer) {
        const remainingTime = Math.ceil((paddleShrinkTimer.endTime - Date.now()) / 1000);
        effectText += `SHRINK: ${remainingTime}s `;
    }
    if (paddleSlowTimer) { 
        const remainingTime = Math.ceil((paddleSlowTimer.endTime - Date.now()) / 1000);
        effectText += `SLOW: ${remainingTime}s`;
    }

    if (effectText) {
        ctx.textAlign = "center"; 
        ctx.fillStyle = "#FF8C00";
        ctx.fillText(effectText, canvas.width / 2, 20);
    }
}

/**
 * 게임 인트로, 게임 클리어 및 오버
 * HTML 요소를 사용하여 게임 상태를 업데이트하는 함수
 */



function updateGameState(state) {
    currentState = state;
    overlay.classList.add("hidden"); 
    restartButton.classList.add("hidden-button"); 
    statusMessage.innerHTML = ""; 
    statusMessage.classList.remove("blinking-message");

    if (state === GAME_STATE.INTRO) {
        statusTitle.textContent = "벽돌 깨기 게임";
        overlay.classList.add("intro"); 
        statusMessage.textContent = "스페이스바를 눌러 게임을 시작하세요! (← → 키 사용)";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
        overlay.classList.remove("hidden");
        
        statusMessage.classList.add("blinking-message");
        //playSound(openingSound); // 오프닝 사운드 재생

        
    } else if (state === GAME_STATE.GAMEOVER) {
        overlay.classList.remove("intro");
        statusTitle.textContent = "😭 GAME OVER";
        playSound(overSound); // 게임오버 사운드 재생
        statusMessage.innerHTML = `최종 점수: <span class="final-score">${score}</span><br>다시 시작하시겠습니까?`;
        overlay.style.backgroundColor = "rgba(180, 0, 0, 0.9)";
        overlay.classList.remove("hidden");
        restartButton.classList.remove("hidden-button"); 
    } else if (state === GAME_STATE.WIN) {
        overlay.classList.remove("intro");
        statusTitle.textContent = "🎉 STAGE CLEAR! 🎉";
        statusMessage.innerHTML = `최종 점수: <span class="final-score">${score}</span><br>축하합니다!`;
        overlay.style.backgroundColor = "rgba(0, 150, 0, 0.9)";
        overlay.classList.remove("hidden");
        restartButton.classList.remove("hidden-button"); 
    } else if (state === GAME_STATE.PLAYING) {
         overlay.classList.remove("intro");
    }
}

// --- 아이템 활성화/비활성화 함수 ---

function createExplosion(x, y, color) {
    const numParticles = 10;
    for (let i = 0; i < numParticles; i++) {
        const velocityX = (Math.random() - 0.5) * 4;
        const velocityY = (Math.random() - 0.5) * 4;
        const size = Math.random() * 3 + 1;
        const decay = Math.random() * 0.05 + 0.02;

        particles.push(new Particle(x, y, color, size, velocityX, velocityY, decay));
    }
}


// function breakBrick(brick) {
//     dropItem(brick);

//     const explosionX = brick.x + brickWidth / 2;
//     const explosionY = brick.y + brickHeight / 2;
//     createExplosion(explosionX, explosionY, brickColorMap[brick.maxHealth]);

//     brick.status = 0;
//     bricksBroken++;
//     score += brick.maxHealth * 10;

//     // 모든 벽돌 깨면 // 251105 스테이지 생성을 위한 코드 수정
//     if (bricksBroken === totalBricks) {
//         if (currentStage < maxStage) {
//             // 🎮 다음 스테이지로 이동
//             currentStage++;
//             nextStage();
//         } else {
//             // 마지막 스테이지 클리어
//             updateGameState(GAME_STATE.WIN);
//         }
//     }
// }
function breakBrick(brick) { // 디버깅 레이저로 인한 다음 스테이지로 넘어가지 않은 버그 수정 코드
    if (isTransitioning) return; // 전환 중이면 중복 실행 방지 

    dropItem(brick);

    const explosionX = brick.x + brickWidth / 2;
    const explosionY = brick.y + brickHeight / 2;
    createExplosion(explosionX, explosionY, brickColorMap[brick.maxHealth]);

    brick.status = 0;
    bricksBroken++;
    score += brick.maxHealth * 10;

    // 모든 벽돌 깨면
    if (bricksBroken === totalBricks) {
        isTransitioning = true; // 전환 시작!

        if (currentStage < maxStage) {
            playSound(roundSound);
            currentStage++;
            setTimeout(() => {
                nextStage();
                isTransitioning = false; // 전환 완료 후 해제
            }, 100); // 살짝 딜레이 주면 자연스럽게 전환
        } else {
            playSound(cleardSound);
            updateGameState(GAME_STATE.WIN);
            isTransitioning = false;
        }
    }
}


function nextStage() { // 251105 스테이지 생성을 위한 코드 수정
    bricksBroken = 0;
    totalBricks = brickRowCount * brickColumnCount;

    initializeBricks();
    resetBallAndPaddle();

    // 속도 및 상태 갱신
    updateBallSpeed();

    // 안내 메시지
    overlay.classList.remove("hidden");
    statusTitle.textContent = `🌟 STAGE ${currentStage} 🌟`;
    statusMessage.textContent = "스페이스바를 눌러 다음 스테이지를 시작하세요!";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    restartButton.classList.add("hidden-button");
    
    currentState = GAME_STATE.INTRO; // 인트로로 전환
}


function dropItem(brick) {
    if (Math.random() < 0.15) { 
        const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)]; 
        const itemX = brick.x + brickWidth / 2 - ITEM_WIDTH / 2;
        const itemY = brick.y + brickHeight / 2 - ITEM_HEIGHT / 2;
        items.push(new Item(itemX, itemY, itemType));
    }
}

function activatePaddleGrow(item) {
    if (paddleGrowTimer) {
        clearTimeout(paddleGrowTimer.id);
        paddleWidth = initialPaddleWidth;
    }

    paddleWidth = initialPaddleWidth + item.type.value;
    paddleX -= item.type.value / 2;
    if (paddleX < 0) paddleX = 0;
    if (paddleX > canvas.width - paddleWidth) paddleX = canvas.width - paddleWidth;

    const endTime = Date.now() + item.type.duration;
    paddleGrowTimer = {
        endTime: endTime,
        id: setTimeout(() => {
            paddleWidth = initialPaddleWidth;
            paddleX += item.type.value / 2; 
            paddleGrowTimer = null;
        }, item.type.duration)
    };
}

function activateLaserShot(item) {
    if (laserActiveTimer) {
        clearTimeout(laserActiveTimer.id);
    }
    
    const endTime = Date.now() + item.type.duration;
    laserActiveTimer = {
        endTime: endTime,
        id: setTimeout(() => {
            laserActiveTimer = null;
        }, item.type.duration)
    };
}

function activateSpeedUp(item) {
    if (speedUpTimer) {
        clearTimeout(speedUpTimer.id);
    }
    
    const endTime = Date.now() + item.type.duration;
    speedUpTimer = {
        endTime: endTime,
        id: setTimeout(() => {
            speedUpTimer = null;
        }, item.type.duration)
    };
    updateBallSpeed();
}

// ⬇️ PADDLE_SHRINK 디버프 활성화 함수
function activatePaddleShrink(item) {
    // 버프/디버프 중첩 방지: 패들 크기 버프가 있다면 초기화
    if (paddleGrowTimer) {
        clearTimeout(paddleGrowTimer.id);
        paddleWidth = initialPaddleWidth;
        paddleGrowTimer = null;
    }
    // 기존 디버프 타이머 초기화
    if (paddleShrinkTimer) {
        clearTimeout(paddleShrinkTimer.id);
        paddleWidth = initialPaddleWidth;
    }

    paddleWidth = initialPaddleWidth - item.type.value; // 너비 감소
    if (paddleWidth < 20) paddleWidth = 20; // 최소 너비 제한

    // 패들을 중앙으로 유지 (축소된 만큼 X좌표 조정)
    paddleX += item.type.value / 2; 
    if (paddleX < 0) paddleX = 0;
    if (paddleX > canvas.width - paddleWidth) paddleX = canvas.width - paddleWidth;

    const endTime = Date.now() + item.type.duration;
    paddleShrinkTimer = {
        endTime: endTime,
        id: setTimeout(() => {
            // 효과 종료 시 패들 너비와 위치 복원
            paddleWidth = initialPaddleWidth;
            // X좌표 복원 시 패들이 캔버스 밖으로 나가지 않도록 경계 검사
            let newPaddleX = paddleX - (item.type.value / 2);
            if (newPaddleX < 0) newPaddleX = 0;
            if (newPaddleX > canvas.width - paddleWidth) newPaddleX = canvas.width - paddleWidth;
            paddleX = newPaddleX;
            paddleShrinkTimer = null;
        }, item.type.duration)
    };
}

// ⬇️ PADDLE_SLOW 디버프 활성화 함수
function activatePaddleSlow(item) {
    if (paddleSlowTimer) {
        clearTimeout(paddleSlowTimer.id);
    }
    
    const endTime = Date.now() + item.type.duration;
    paddleSlowTimer = {
        endTime: endTime,
        id: setTimeout(() => {
            paddleSlowTimer = null;
        }, item.type.duration)
    };
}


function shootLaser() {
    if (laserActiveTimer) {
        lasers.push(new Laser(paddleX + 5, canvas.height - paddleHeight - LASER_HEIGHT));
        lasers.push(new Laser(paddleX + paddleWidth - 5 - LASER_WIDTH, canvas.height - paddleHeight - LASER_HEIGHT));
        playSound(laserSound); 
    }
}

// --- 충돌 및 상태 관리 함수 ---

function itemCollisionDetection() {
    for(let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item.y + item.height > canvas.height - paddleHeight &&
            item.y < canvas.height &&
            item.x + item.width > paddleX &&
            item.x < paddleX + paddleWidth) {
            
            items.splice(i, 1);
            playSound(itemSound); // 아이템 먹는 사운드

            
            if (item.type.type === "PADDLE_GROW") {
                activatePaddleGrow(item);
            } else if (item.type.type === "LASER_SHOT") { 
                activateLaserShot(item);
            } else if (item.type.type === "SPEED_UP") {
                activateSpeedUp(item);
            }
            // ⬇️ 디버프 처리 로직 추가
            else if (item.type.type === "PADDLE_SHRINK") {
                activatePaddleShrink(item);
            } else if (item.type.type === "PADDLE_SLOW") {
                activatePaddleSlow(item);
            }
        }
    }
}

function laserCollisionDetection() {
    for (let l = lasers.length - 1; l >= 0; l--) {
        const laser = lasers[l];
        let hit = false;
        
        for(let c = 0; c < brickColumnCount; c++) {
            for(let r = 0; r < brickRowCount; r++) {
                const brick = bricks[c][r];
                if(brick.status === 1) {
                    if (laser.x < brick.x + brickWidth && 
                        laser.x + laser.width > brick.x && 
                        laser.y < brick.y + brickHeight && 
                        laser.y + laser.height > brick.y) {
                        
                        brick.health--;
                        hit = true;
                        
                        if (brick.health <= 0) {
                            breakBrick(brick);
                        } else {
                            score += 2; 
                        }
                        
                        if (currentState === GAME_STATE.WIN) return; 
                        
                        break; 
                    }
                }
            }
            if (hit) break;
        }
        
        if (hit) {
            lasers.splice(l, 1); 
        }
    }
}

// function updateBallSpeed() {
//     // 1. 기본 속도 계산 (점수 기반)
//     const speedIncreaseFactor = Math.floor(bricksBroken / 5);
//     let currentBaseSpeed = 3 + (speedIncreaseFactor * 0.1); 
    
//     // 2. SPEED UP 아이템 효과 적용
//     if (speedUpTimer) {
//         const speedItem = itemTypes.find(item => item.type === "SPEED_UP");
//         if (speedItem) {
//             currentBaseSpeed *= speedItem.value;
//         }
//     }
    
//     // 최종 baseSpeed에 반영
//     baseSpeed = currentBaseSpeed; 

//     // 3. 현재 떠 있는 모든 공의 속도를 재설정
//     for (const ball of balls) {
//         if (typeof ball.dx !== 'number' || typeof ball.dy !== 'number' || isNaN(ball.dx) || isNaN(ball.dy) || (Math.abs(ball.dx) < 1 && Math.abs(ball.dy) < 1)) {
//             ball.dx = baseSpeed * (Math.random() > 0.5 ? 1 : -1);
//             ball.dy = -baseSpeed;
//             continue; 
//         }

//         let signX = Math.sign(ball.dx);
//         let signY = Math.sign(ball.dy);
        
//         if (signX === 0) signX = Math.random() > 0.5 ? 1 : -1;
//         if (signY === 0) signY = -1; 

//         // 속도 크기를 현재 baseSpeed로 유지
//         ball.dx = signX * baseSpeed;
//         ball.dy = signY * baseSpeed;
//     }
// }
function updateBallSpeed() { // 251105 스테이지 생성을 위한 코드 수정
    // ① 스테이지에 따른 기본 속도 증가
    // 스테이지 1 → +0, 스테이지 2 → +0.8, 스테이지 3 → +1.6
    const stageSpeedBoost = (currentStage - 1) * 0.8;  

    // ② 벽돌을 부술 때마다 점진적으로 가속 (5개 부술 때마다 +0.1)
    const speedIncreaseFactor = Math.floor(bricksBroken / 5) * 0.1;

    // ③ 기본 속도 계산 (기본값 3)
    let currentBaseSpeed = 3 + stageSpeedBoost + speedIncreaseFactor;

    // ④ SPEED UP 아이템 효과 적용
    if (speedUpTimer) {
        const speedItem = itemTypes.find(item => item.type === "SPEED_UP");
        if (speedItem) currentBaseSpeed *= speedItem.value;
    }

    // ⑤ 너무 빨라지지 않도록 상한 설정 (예: 8)
    if (currentBaseSpeed > 8) currentBaseSpeed = 8;

    // ⑥ 최종 baseSpeed 반영
    baseSpeed = currentBaseSpeed;

    // ⑦ 현재 떠 있는 모든 공의 속도 재조정
    for (const ball of balls) {
        // 혹시 잘못된 값일 경우 초기화
        if (
            typeof ball.dx !== "number" ||
            typeof ball.dy !== "number" ||
            isNaN(ball.dx) ||
            isNaN(ball.dy) ||
            (Math.abs(ball.dx) < 1 && Math.abs(ball.dy) < 1)
        ) {
            ball.dx = baseSpeed * (Math.random() > 0.5 ? 1 : -1);
            ball.dy = -baseSpeed;
            continue;
        }

        // 현재 이동 방향 유지
        let signX = Math.sign(ball.dx);
        let signY = Math.sign(ball.dy);

        if (signX === 0) signX = Math.random() > 0.5 ? 1 : -1;
        if (signY === 0) signY = -1;

        // 방향 유지한 채 속도만 변경
        ball.dx = signX * baseSpeed;
        ball.dy = signY * baseSpeed;
    }
}


function clearAllEffects() {
    // ⬇️ 버프 타이머 클리어
    if (paddleGrowTimer) {
        clearTimeout(paddleGrowTimer.id);
        paddleGrowTimer = null;
    }
    if (laserActiveTimer) {
        clearTimeout(laserActiveTimer.id);
        laserActiveTimer = null;
    }
    if (speedUpTimer) {
        clearTimeout(speedUpTimer.id);
        speedUpTimer = null;
    }
    
    // ⬇️ 디버프 타이머 클리어 추가
    if (paddleShrinkTimer) {
        clearTimeout(paddleShrinkTimer.id);
        paddleShrinkTimer = null;
    }
    if (paddleSlowTimer) {
        clearTimeout(paddleSlowTimer.id);
        paddleSlowTimer = null;
    }
    
    // 패들 너비 초기화 (버프/디버프 모두 해제)
    paddleWidth = initialPaddleWidth; 
    
    updateBallSpeed(); 

    lasers = []; 
    balls = balls.slice(0, 1); 
}

function resetBallAndPaddle() {
    clearAllEffects(); // ⬇️ 생명을 잃으면 모든 효과 초기화
    
    paddleX = (canvas.width - paddleWidth) / 2; 

    balls = [createBall()]; 
    
    balls[0].x = paddleX + paddleWidth / 2; 
    balls[0].y = canvas.height - paddleHeight - ballRadius; 
    
    ballOnPaddle = true;
    
    spacePressed = false;

    items = [];
    particles = [];
}

function resetGame() {
    clearAllEffects(); 
    
    currentStage = 1; // 첫 스테이지로 리셋, 251105 스테이지 생성을 위한 코드 수정
    bricksBroken = 0; 
    score = 0;
    lives = 3; 
    
    initializeBricks(); 

    particles = [];
    items = [];
    
    resetBallAndPaddle(); 
    // 게임 재시작 시 게임오버 사운드 중단
    if (!overSound.paused) { 
        overSound.pause();
        overSound.currentTime = 0;
    }
    // 재시작 시 오프닝 사운드 자동 재생
    playSound(openingSound);

    updateGameState(GAME_STATE.INTRO);
}

/**
 * 공의 위치 업데이트와 경계 및 패들 충돌을 처리하는 함수
 */
function updateBalls() {
    if (ballOnPaddle) {
        if (balls.length === 0) {
            resetBallAndPaddle();
            return;
        }
        balls[0].x = paddleX + paddleWidth / 2; 
        balls[0].y = canvas.height - paddleHeight - ballRadius;
        return; 
    }

    for(let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];

        // 1. 벽 충돌 감지
        if(ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) {
            ball.dx = -ball.dx;
            playSound(bounceSound);
        }
        if(ball.y + ball.dy < ball.radius) {
            ball.dy = -ball.dy;
            playSound(bounceSound);
        } 
        else if(ball.y + ball.dy > canvas.height - ball.radius) {
            // 패들 충돌 감지
            if(ball.x > paddleX && ball.x < paddleX + paddleWidth) {
                const relativeX = ball.x - (paddleX + paddleWidth / 2);
                ball.dx = relativeX * 0.2;
                ball.dy = -Math.abs(ball.dy);
                playSound(bounceSound);
            } else {
                // 공을 놓쳤을 경우
                playSound(dropSound); // 공 놓친 사운드
                balls.splice(i, 1); 
                
                if (balls.length === 0) { 
                    lives--; 
                    if (lives <= 0) {
                        updateGameState(GAME_STATE.GAMEOVER); 
                        return; 
                    } else {
                        resetBallAndPaddle(); 
                        return; 
                    }
                }
                continue;
            }
        }
        
        // 2. 공 위치 업데이트
        ball.x += ball.dx;
        ball.y += ball.dy;
        collisionDetection(ball);
        
        if (currentState !== GAME_STATE.PLAYING) {
            return;
        }
    }
}

function collisionDetection(ball) {
    for(let c = 0; c < brickColumnCount; c++) {
        for(let r = 0; r < brickRowCount; r++) {
            const brick = bricks[c][r];
            if(brick.status === 1) {
                if(ball.x > brick.x && ball.x < brick.x + brickWidth && ball.y > brick.y && ball.y < brick.y + brickHeight) {
                    ball.dy = -ball.dy; 
                    brick.health--;
                    playSound(hitSound); // 벽돌 HP 감소 사운드
                    
                    if (brick.health <= 0) {
                        breakBrick(brick);
                        playSound(brickSound); // 벽돌 부숴지는 사운드
                    } else {
                        score += 5; 
                    }
                    
                    if (currentState === GAME_STATE.WIN) {
                        return; 
                    }
                }
            }
        }
    }
}


// --- 이벤트 핸들러 ---

function keyDownHandler(e) {
    if(e.key === "Right" || e.key === "ArrowRight") {
        rightPressed = true;
    } else if(e.key === "Left" || e.key === "ArrowLeft") {
        leftPressed = true;
    }
    // 디버깅을 위한 L키로 레이저 모드 토글 (ON/OFF)
    if (e.key === "l" || e.key === "L") {
        if (laserActiveTimer && laserActiveTimer.endTime === Infinity) {
            laserActiveTimer = null;
            console.log("❌ 레이저 무한 모드 비활성화");
        } else {
            laserActiveTimer = { endTime: Infinity, id: null };
            playSound(laserSound);
            console.log("🚀 레이저 무한 모드 활성화!");
        }
    }

    if(e.key === " " || e.key === "Spacebar") {
        e.preventDefault(); 
        
        if (currentState === GAME_STATE.INTRO) {
            updateGameState(GAME_STATE.PLAYING);
            if (!openingSound.paused) { // 게임 시작 시 인트로 음악 중단.
                openingSound.pause();
                openingSound.currentTime = 0;
            }
        } 

        if (currentState === GAME_STATE.PLAYING) {
            if (ballOnPaddle) {
                ballOnPaddle = false;
            } else if (laserActiveTimer && !spacePressed) {
                shootLaser();
                // 사운드는 shootLaser 함수 안에서 재생됩니다.
            }
        }
        spacePressed = true;
    }
}

function keyUpHandler(e) {
    if(e.key === "Right" || e.key === "ArrowRight") {
        rightPressed = false;
    } else if(e.key === "Left" || e.key === "ArrowLeft") {
        leftPressed = false;
    } else if(e.key === " " || e.key === "Spacebar") {
        spacePressed = false; 
    }
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

// 재시작 버튼 이벤트 리스너
restartButton.addEventListener('click', resetGame); 

// --- 메인 드로잉 루프 (게임 엔진) ---

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    
    if (currentState === GAME_STATE.PLAYING) { 
        drawBricks();
        drawBalls();
        drawPaddle();
        drawScore();
        drawParticles();
        drawItems();
        drawLasers();
        
        updateBalls(); 
        itemCollisionDetection();
        laserCollisionDetection(); 
        updateBallSpeed();

        // ⬇️ 패들 이동 속도 계산 및 디버프 적용
        let currentPaddleSpeed = basePaddleSpeed; 
        const paddleSlowItem = itemTypes.find(item => item.type === "PADDLE_SLOW");
        
        if (paddleSlowTimer && paddleSlowItem) {
            currentPaddleSpeed *= paddleSlowItem.value; 
        }

        if(rightPressed && paddleX < canvas.width - paddleWidth) {
            paddleX += currentPaddleSpeed;
        } else if(leftPressed && paddleX > 0) {
            paddleX -= currentPaddleSpeed;
        }
    }

    requestAnimationFrame(draw);
}

// 브라우저 정책상 초기 화면에서는 오프닝이 나오지 않음
// 그래서 최초 1회만 실행될 리스너를 문서 전체에 등록 (클릭 또는 키 입력)
function handleFirstInteraction() {
    // 현재 상태가 INTRO일 때만 사운드 재생 시도
    if (currentState === GAME_STATE.INTRO) {
        playSound(openingSound); 
    }
}

// document에 클릭 또는 키 입력 리스너 등록 ({ once: true }로 1회만 실행 보장)
document.addEventListener('click', handleFirstInteraction, { once: true });

// 게임 시작 시 인트로 화면 표시
updateGameState(GAME_STATE.INTRO);
draw();

// ⬇️ 여기에 있던 불필요한 닫는 괄호('}')를 제거했습니다.
