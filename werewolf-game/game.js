// ===== WEREWOLF GAME =====
const ROLES = {
  WEREWOLF: 'werewolf',
  VILLAGER: 'villager',
  PROTECTOR: 'protector',
  SEER: 'seer'
};

const PHASE = {
  NIGHT: 'night',
  DAY: 'day'
};

const ROLE_CONFIG = {
  werewolf: {
    icon: '🐺',
    name: 'Ma Sói',
    description: 'Ban đêm bạn hãy chọn 1 dân làng để tiêu diệt. Ban ngày giữ bí mật danh tính của mình.'
  },
  villager: {
    icon: '👨‍🌾',
    name: 'Dân Làng',
    description: 'Ban ngày hãy bỏ phiếu để loại ra ma sói. Ban đêm bạn không thể làm gì cả.'
  },
  protector: {
    icon: '🛡️',
    name: 'Nhà Bảo Vệ',
    description: 'Mỗi đêm chọn 1 người để bảo vệ. Nếu ma sói chọn người đó, họ sẽ sống sót.'
  },
  seer: {
    icon: '🔮',
    name: 'Tiên Tri',
    description: 'Mỗi đêm chọn 1 người để kiểm tra. Bạn sẽ biết họ là ma sói hay không.'
  }
};

let gameState = {
  players: [],
  currentPhase: PHASE.NIGHT,
  round: 1,
  gameEnded: false,
  winner: null,
  currentPlayerIndex: 0,
  selectedTarget: -1,
  voteResults: {},
  gameLog: []
};

// ===== INITIALIZATION =====
function initGame(playerCount) {
  gameState.players = [];
  gameState.round = 1;
  gameState.gameEnded = false;
  gameState.winner = null;
  gameState.gameLog = [];
  gameState.currentPhase = PHASE.NIGHT;

  // Assign roles
  let roles = [];
  let werewolfCount = Math.ceil(playerCount / 3);
  let protectorCount = 1;
  let seerCount = 1;
  let villagerCount = playerCount - werewolfCount - protectorCount - seerCount;

  for (let i = 0; i < werewolfCount; i++) roles.push(ROLES.WEREWOLF);
  for (let i = 0; i < protectorCount; i++) roles.push(ROLES.PROTECTOR);
  for (let i = 0; i < seerCount; i++) roles.push(ROLES.SEER);
  for (let i = 0; i < villagerCount; i++) roles.push(ROLES.VILLAGER);

  // Shuffle roles
  roles = roles.sort(() => Math.random() - 0.5);

  for (let i = 0; i < playerCount; i++) {
    gameState.players.push({
      id: i,
      number: i + 1,
      role: roles[i],
      alive: true,
      revealed: false,
      suspicion: 0
    });
  }

  addLog(`Game bắt đầu với ${playerCount} người chơi!`, 'info');
}

function getRandomAlivePlayer(exclude = -1) {
  let alive = gameState.players.filter((p, i) => p.alive && i !== exclude);
  if (alive.length === 0) return -1;
  return alive[Math.floor(Math.random() * alive.length)].id;
}

// ===== GAME FLOW =====
function startNightPhase() {
  gameState.currentPhase = PHASE.NIGHT;
  gameState.currentPlayerIndex = 0;
  gameState.selectedTarget = -1;

  updatePhaseInfo();
  runNightActionsSequence();
}

function runNightActionsSequence() {
  let role = gameState.players[gameState.currentPlayerIndex].role;

  if (!gameState.players[gameState.currentPlayerIndex].alive) {
    skipToNextNightPlayer();
    return;
  }

  if (role === ROLES.WEREWOLF) {
    showActionPrompt(`Ma Sói #${gameState.currentPlayerIndex + 1} hãy chọn nạn nhân:`, 'werewolf');
  } else if (role === ROLES.PROTECTOR) {
    showActionPrompt(`Nhà Bảo Vệ #${gameState.currentPlayerIndex + 1} hãy chọn người để bảo vệ:`, 'protector');
  } else if (role === ROLES.SEER) {
    showActionPrompt(`Tiên Tri #${gameState.currentPlayerIndex + 1} hãy chọn người để kiểm tra:`, 'seer');
  } else {
    skipToNextNightPlayer();
  }
}

function skipToNextNightPlayer() {
  gameState.currentPlayerIndex++;
  if (gameState.currentPlayerIndex >= gameState.players.length) {
    startDayPhase();
  } else {
    runNightActionsSequence();
  }
}

function startDayPhase() {
  gameState.currentPhase = PHASE.DAY;
  updatePhaseInfo();
  showVotingScreen();
}

function startVoting() {
  gameState.voteResults = {};
  gameState.currentPlayerIndex = 0;
  
  // If all players voted, calculate result
  if (Object.keys(gameState.voteResults).length === gameState.players.filter(p => p.alive).length) {
    executeVoteResult();
    return;
  }

  showNextVoter();
}

function showNextVoter() {
  while (gameState.currentPlayerIndex < gameState.players.length) {
    if (gameState.players[gameState.currentPlayerIndex].alive) {
      showVotingScreen();
      return;
    }
    gameState.currentPlayerIndex++;
  }
  executeVoteResult();
}

function executeVoteResult() {
  let votes = {};
  Object.values(gameState.voteResults).forEach(targetId => {
    votes[targetId] = (votes[targetId] || 0) + 1;
  });

  let maxVotes = Math.max(...Object.values(votes));
  let eliminated = Object.keys(votes).filter(id => votes[id] === maxVotes).map(Number);

  if (eliminated.length > 1) {
    addLog(`Phiếu bầu hòa: Không loại người nào!`, 'warning');
  } else {
    let target = gameState.players[eliminated[0]];
    killPlayer(eliminated[0]);
    addLog(`${target.role === ROLES.WEREWOLF ? '🐺' : target.role === ROLES.SEER ? '🔮' : target.role === ROLES.PROTECTOR ? '🛡️' : '👨‍🌾'} Người chơi #${target.number} (${ROLE_CONFIG[target.role].name}) đã bị loại!`, 'death');
  }

  checkGameEnd();
  if (!gameState.gameEnded) {
    gameState.round++;
    startNightPhase();
  }
}

// ===== GAME ACTIONS =====
function killPlayer(playerId) {
  gameState.players[playerId].alive = false;
  addLog(`👻 Người chơi #${playerId + 1} đã chết!`, 'death');
  updateUI();
}

function performWerewolfAction() {
  if (gameState.selectedTarget === -1) return;
  
  let target = gameState.players[gameState.selectedTarget];
  addLog(`🐺 Ma Sói #${gameState.currentPlayerIndex + 1} muốn tiêu diệt #${target.number}`, 'warning');
  
  gameState.currentPlayerIndex++;
  skipToNextNightPlayer();
}

function performProtectorAction() {
  if (gameState.selectedTarget === -1) return;
  
  let protector = gameState.players[gameState.currentPlayerIndex];
  let target = gameState.players[gameState.selectedTarget];
  
  addLog(`🛡️ Nhà Bảo Vệ #${protector.number} bảo vệ #${target.number}`, 'info');
  
  gameState.currentPlayerIndex++;
  skipToNextNightPlayer();
}

function performSeerAction() {
  if (gameState.selectedTarget === -1) return;
  
  let seer = gameState.players[gameState.currentPlayerIndex];
  let target = gameState.players[gameState.selectedTarget];
  let isWerewolf = target.role === ROLES.WEREWOLF ? 'CÓ' : 'KHÔNG';
  
  addLog(`🔮 Tiên Tri #${seer.number} kiểm tra #${target.number}: ${isWerewolf} là ma sói`, 'info');
  
  gameState.currentPlayerIndex++;
  skipToNextNightPlayer();
}

// ===== CHECK WIN CONDITIONS =====
function checkGameEnd() {
  let werewolves = gameState.players.filter(p => p.alive && p.role === ROLES.WEREWOLF);
  let villagers = gameState.players.filter(p => p.alive && (p.role !== ROLES.WEREWOLF));

  if (werewolves.length === 0) {
    gameState.gameEnded = true;
    gameState.winner = 'villagers';
    addLog(`🎉 DÂN LÀNG THẮNG! Ma sói đã bị tiêu diệt hết!`, 'info');
  } else if (werewolves.length >= villagers.length) {
    gameState.gameEnded = true;
    gameState.winner = 'werewolves';
    addLog(`🎉 MA SÓI THẮNG! Ma sói nhiều bằng dân làng rồi!`, 'warning');
  }
}

// ===== UI UPDATES =====
function updateUI() {
  updatePhaseInfo();
  updatePlayersDisplay();
  updateStats();
}

function updatePhaseInfo() {
  let phaseTitle = document.getElementById('phaseTitle');
  let phaseDesc = document.getElementById('phaseDesc');

  if (gameState.currentPhase === PHASE.NIGHT) {
    phaseTitle.textContent = '🌙 BAN ĐÊM';
    phaseDesc.textContent = 'Ma sói, Nhà Bảo Vệ, Tiên Tri hãy thực hiện hành động...';
  } else {
    phaseTitle.textContent = '☀️ BAN NGÀY';
    phaseDesc.textContent = 'Tất cả mọi người hãy bỏ phiếu loại ra 1 người!';
  }

  document.getElementById('round').textContent = gameState.round;
}

function updatePlayersDisplay() {
  let grid = document.getElementById('playersGrid');
  grid.innerHTML = '';

  gameState.players.forEach((player, idx) => {
    let card = document.createElement('div');
    card.className = `playerCard ${!player.alive ? 'dead' : ''} ${gameState.selectedTarget === idx ? 'selected' : ''}`;
    
    let role = player.revealed && !player.alive ? ROLE_CONFIG[player.role].icon : (player.alive ? '?' : '💀');
    
    card.innerHTML = `
      <div class="name">Người #${player.number}</div>
      <div class="role">${role}</div>
    `;

    if (player.alive && gameState.currentPhase === PHASE.NIGHT) {
      card.onclick = () => selectTarget(idx);
    } else if (player.alive && gameState.currentPhase === PHASE.DAY) {
      card.onclick = () => selectVoteTarget(idx);
    }

    grid.appendChild(card);
  });
}

function updateStats() {
  let werewolves = gameState.players.filter(p => p.alive && p.role === ROLES.WEREWOLF).length;
  let villagers = gameState.players.filter(p => p.alive && p.role !== ROLES.WEREWOLF).length;

  document.getElementById('villagerCount').textContent = villagers;
  document.getElementById('werewolfCount').textContent = werewolves;
}

function addLog(text, type = 'info') {
  gameState.gameLog.push({ text, type });
  updateLogDisplay();
}

function updateLogDisplay() {
  let log = document.getElementById('gameLog');
  log.innerHTML = '';

  gameState.gameLog.slice(-10).forEach(entry => {
    let div = document.createElement('div');
    div.className = `logEntry ${entry.type}`;
    div.textContent = entry.text;
    log.appendChild(div);
  });
}

// ===== SCREEN TRANSITIONS =====
function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenName + 'Screen').classList.add('active');
}

function showRoleReveal(playerIndex) {
  let player = gameState.players[playerIndex];
  let roleConfig = ROLE_CONFIG[player.role];

  document.getElementById('revealTitle').textContent = `Vai Trò Của Bạn - Người #${player.number}`;
  document.getElementById('revealContent').innerHTML = `<div>${roleConfig.icon}</div>`;
  document.getElementById('revealDesc').textContent = roleConfig.description;

  let btn = document.getElementById('acknowledgeBtn');
  btn.onclick = () => {
    gameState.currentPlayerIndex++;
    if (gameState.currentPlayerIndex < gameState.players.length) {
      showRoleReveal(gameState.currentPlayerIndex);
    } else {
      showScreen('game');
      startNightPhase();
    }
  };

  showScreen('roleReveal');
}

function showActionPrompt(prompt, actionType) {
  gameState.selectedTarget = -1;
  document.getElementById('actionContent').textContent = prompt;

  let confirmBtn = document.getElementById('confirmBtn');
  let skipBtn = document.getElementById('skipBtn');

  confirmBtn.style.display = 'inline-block';
  skipBtn.style.display = 'inline-block';

  confirmBtn.onclick = () => {
    if (actionType === 'werewolf') performWerewolfAction();
    else if (actionType === 'protector') performProtectorAction();
    else if (actionType === 'seer') performSeerAction();
  };

  skipBtn.onclick = () => skipToNextNightPlayer();

  updatePlayersDisplay();
}

function showVotingScreen() {
  if (gameState.currentPlayerIndex >= gameState.players.length || !gameState.players[gameState.currentPlayerIndex].alive) {
    executeVoteResult();
    return;
  }

  let voter = gameState.players[gameState.currentPlayerIndex];
  gameState.selectedTarget = -1;

  let options = document.getElementById('voteOptions');
  options.innerHTML = '';

  gameState.players.forEach((player, idx) => {
    if (player.alive && idx !== gameState.currentPlayerIndex) {
      let opt = document.createElement('div');
      opt.className = 'voteOption';
      opt.innerHTML = `<div class="number">#${player.number}</div><div class="label">Người</div>`;
      opt.onclick = () => selectVoteTarget(idx);
      options.appendChild(opt);
    }
  });

  let voteBtn = document.getElementById('voteBtn');
  voteBtn.style.display = 'inline-block';
  voteBtn.textContent = `✓ BỎ PHIẾU (Người #${voter.number})`;
  voteBtn.onclick = () => {
    if (gameState.selectedTarget === -1) return;
    gameState.voteResults[gameState.currentPlayerIndex] = gameState.selectedTarget;
    gameState.currentPlayerIndex++;
    showVotingScreen();
  };

  showScreen('vote');
}

function selectTarget(idx) {
  gameState.selectedTarget = idx;
  updatePlayersDisplay();
}

function selectVoteTarget(idx) {
  gameState.selectedTarget = idx;
  let options = document.querySelectorAll('.voteOption');
  options.forEach((opt, i) => {
    opt.classList.remove('selected');
  });
  event.target.closest('.voteOption').classList.add('selected');
}

function showGameOver() {
  let content = document.getElementById('endContent');
  let isWerewolfWin = gameState.winner === 'werewolves';

  let result = isWerewolfWin 
    ? `<div class="endResult">🐺 MA SÓI THẮNG! 🐺</div>`
    : `<div class="endResult">🎉 DÂN LÀNG THẮNG! 🎉</div>`;

  let stats = '<div class="endStats">';
  gameState.players.forEach(p => {
    stats += `<div class="endStat">${ROLE_CONFIG[p.role].icon} Người #${p.number}: ${ROLE_CONFIG[p.role].name}</div>`;
  });
  stats += '</div>';

  content.innerHTML = result + stats;

  document.getElementById('playAgainBtn').onclick = () => {
    let count = parseInt(document.getElementById('playerCount').value);
    initGame(count);
    gameState.currentPlayerIndex = 0;
    showRoleReveal(0);
  };

  document.getElementById('homeBtn').onclick = () => showScreen('menu');

  showScreen('end');
}

// ===== MAIN MENU =====
document.getElementById('playerCount').addEventListener('input', (e) => {
  let count = parseInt(e.target.value);
  let roleInfo = document.getElementById('roleInfo');
  roleInfo.innerHTML = '';

  let werewolfCount = Math.ceil(count / 3);
  let protectorCount = 1;
  let seerCount = 1;
  let villagerCount = count - werewolfCount - protectorCount - seerCount;

  roleInfo.innerHTML = `
    <div class="roleItem">🐺 Ma Sói: ${werewolfCount}</div>
    <div class="roleItem">👨‍🌾 Dân Làng: ${villagerCount}</div>
    <div class="roleItem">🛡️ Bảo Vệ: ${protectorCount}</div>
    <div class="roleItem">🔮 Tiên Tri: ${seerCount}</div>
  `;
});

document.getElementById('startBtn').onclick = () => {
  let count = parseInt(document.getElementById('playerCount').value);
  if (count < 5 || count > 20) {
    alert('Số người chơi phải từ 5 đến 20!');
    return;
  }
  initGame(count);
  gameState.currentPlayerIndex = 0;
  showRoleReveal(0);
};

document.getElementById('menuBtn').onclick = () => {
  if (confirm('Bạn có chắc chắn muốn về menu? Game sẽ reset.')) {
    showScreen('menu');
  }
};

// Initialize on load
document.getElementById('playerCount').dispatchEvent(new Event('input'));
