document.addEventListener('DOMContentLoaded', () => {

  // Game State and Settings
  let coins = 6;
  const PLAY_COST = 2;
  const collectedToys = new Set();
  
  // DOM Elements
  const elements = {
      clawMachine: document.querySelector('.claw-machine'),
      box: document.querySelector('.box'),
      collectionBox: document.querySelector('.collection-box'),
      collectionArrow: document.querySelector('.collection-arrow'),
      toys: [],
      coinCount: document.getElementById('coin-count'),
      missionBtn: document.getElementById('mission-btn'),
      albumBtn: document.getElementById('album-btn'),
      albumModal: document.getElementById('album-modal'),
      albumGrid: document.getElementById('album-grid'),
      missionModal: document.getElementById('mission-modal'),
      // Elemen untuk notifikasi custom
      customAlertModal: document.getElementById('custom-alert-modal'),
      customAlertMessage: document.getElementById('custom-alert-message'),
      customAlertOkBtn: document.getElementById('custom-alert-ok-btn'),
  };

  const settings = {
      targetToy: null,
  };

  const m = 2;
  const allToyTypes = {
      bear: { w: 20 * m, h: 27 * m },
      bunny: { w: 20 * m, h: 29 * m },
      golem: { w: 20 * m, h: 27 * m },
      cucumber: { w: 16 * m, h: 28 * m },
      penguin: { w: 24 * m, h: 22 * m },
      robot: { w: 20 * m, h: 30 * m },
  };

  const sortedToys = [...Object.keys(allToyTypes), ...Object.keys(allToyTypes)].sort(
      () => 0.5 - Math.random(),
  );

  const cornerBuffer = 16;
  const machineBuffer = { x: 36, y: 16 };
  const radToDeg = rad => Math.round(rad * (180 / Math.PI));
  const calcX = (i, n) => i % n;
  const calcY = (i, n) => Math.floor(i / n);

  const {
      width: machineWidth,
      height: machineHeight,
      top: machineTop,
  } = elements.clawMachine.getBoundingClientRect();

  const { height: machineTopHeight } = document.querySelector('.machine-top').getBoundingClientRect();
  const { height: machineBottomHeight, top: machineBottomTop } = document.querySelector('.machine-bottom').getBoundingClientRect();
  const maxArmLength = machineBottomTop - machineTop - machineBuffer.y;
  const adjustAngle = angle => (angle % 360 < 0 ? angle % 360 + 360 : angle % 360);
  const randomN = (min, max) => Math.round(min - 0.5 + Math.random() * (max - min + 1));
  
  // --- FUNGSI NOTIFIKASI BARU ---
  function showCustomAlert(message) {
    elements.customAlertMessage.textContent = message;
    elements.customAlertModal.style.display = 'flex';
  }

  // Game Logic Functions
  function updateCoinDisplay() {
      elements.coinCount.textContent = coins;
      checkCoinStatus();
  }

  function checkCoinStatus() {
      const canPlay = coins >= PLAY_COST;
      if (canPlay) {
          horiBtn.activate();
          horiBtn.el.classList.remove('deactivated');
      } else {
          horiBtn.deactivate();
          horiBtn.el.classList.add('deactivated');
      }
  }

  function handlePlayAttempt() {
      if (coins < PLAY_COST) {
          showCustomAlert("Koin tidak cukup! Butuh 2 koin untuk bermain.");
          return false;
      }
      coins -= PLAY_COST;
      updateCoinDisplay();
      return true;
  }
  
  // Classes
  class Button {
      constructor({ className, pressAction, releaseAction }) {
          this.el = document.querySelector(`.${className}`);
          this.isLocked = true;
          this.pressAction = pressAction;
          this.releaseAction = releaseAction;
          
          ['mousedown', 'touchstart'].forEach(event => this.el.addEventListener(event, this.pressAction));
          ['mouseup', 'touchend'].forEach(event => this.el.addEventListener(event, this.releaseAction));
      }
      activate() {
          this.isLocked = false;
          this.el.classList.add('active');
      }
      deactivate() {
          this.isLocked = true;
          this.el.classList.remove('active');
      }
  }

  class WorldObject {
      constructor(props) {
        Object.assign(this, {
          x: 0, y: 0, z: 0, angle: 0, transformOrigin: { x: 0, y: 0 },
          interval: null, default: {}, moveWith: [],
          el: props.className && document.querySelector(`.${props.className}`),
          ...props,
        });
        this.setStyles();
        if (props.className) {
          const { width, height } = this.el.getBoundingClientRect();
          this.w = width;
          this.h = height;
        }
        ['x', 'y', 'w', 'h'].forEach(key => this.default[key] = this[key]);
      }
      setStyles() {
        Object.assign(this.el.style, {
          left: `${this.x}px`, top: !this.bottom && `${this.y}px`, bottom: this.bottom,
          width: `${this.w}px`, height: `${this.h}px`, transformOrigin: this.transformOrigin,
          zIndex: this.z,
        });
      }
      setClawPos(clawPos) { this.clawPos = clawPos; }
      setTransformOrigin(transformOrigin) {
        this.transformOrigin = transformOrigin === 'center' ? 'center' : `${transformOrigin.x}px ${transformOrigin.y}px`;
        this.setStyles();
      }
      handleNext(next) {
        clearInterval(this.interval);
        if (next) next();
      }
      resumeMove({ moveKey, target, moveTime, next }) {
        this.interval = null;
        this.move({ moveKey, target, moveTime, next });
      }
      resizeShadow() {
        elements.box.style.setProperty('--scale', 0.5 + this.h / maxArmLength / 2);
      }
      move({ moveKey, target, moveTime, next }) {
        if (this.interval) {
            this.handleNext();
        }
        const moveTarget = target ?? this.default[moveKey];
        this.interval = setInterval(() => {
          const distance = Math.abs(this[moveKey] - moveTarget) < 10 ? Math.abs(this[moveKey] - moveTarget) : 10;
          const increment = this[moveKey] > moveTarget ? -distance : distance;
          if ((increment > 0 ? this[moveKey] < moveTarget : this[moveKey] > moveTarget)) {
            this[moveKey] += increment;
            this.setStyles();
            if (moveKey === 'h') this.resizeShadow();
            this.moveWith.forEach(obj => {
              if (obj) {
                obj[moveKey === 'h' ? 'y' : moveKey] += increment;
                obj.setStyles();
              }
            });
          } else {
            this.handleNext(next);
          }
        }, moveTime || 100);
      }
  }
  
  class Toy extends WorldObject {
    constructor(props) {
        const toyType = sortedToys[props.index];
        const size = allToyTypes[toyType];
        super({
            el: Object.assign(document.createElement('div'), { className: `toy pix ${toyType}` }),
            x: cornerBuffer + calcX(props.index, 4) * ((machineWidth - cornerBuffer * 3) / 4) + size.w / 2 + randomN(-6, 6),
            y: machineBottomTop - machineTop + cornerBuffer + calcY(props.index, 4) * ((machineBottomHeight - cornerBuffer * 2) / 3) - size.h / 2 + randomN(-2, 2),
            z: 0, toyType, ...size, ...props,
        });
        elements.box.append(this.el);
        // Event listener untuk memulai koleksi saat diklik
        this.el.addEventListener('click', () => this.handleCollection());
        elements.toys.push(this);
    }
    
handleCollection() {
    if (!this.el.classList.contains('selected')) return;

    this.el.classList.remove('selected');
    elements.collectionArrow.classList.remove('active');
    collectedToys.add(this.toyType);

    const albumBtnRect = elements.albumBtn.getBoundingClientRect();
    const machineRect = elements.clawMachine.getBoundingClientRect();

    // titik tengah mesin
    const centerX = Math.round(machineRect.width / 2 - this.w / 2);
    const centerY = Math.round(machineRect.height / 2 - this.h / 2);

    // titik album
    const targetX = Math.round(albumBtnRect.left + albumBtnRect.width / 2 - machineRect.left - this.w / 2);
    const targetY = Math.round(albumBtnRect.top + albumBtnRect.height / 2 - machineRect.top - this.h / 2);

    this.setTransformOrigin('center');
    this.el.style.zIndex = 201;

    // STEP 1: gerak ke center (0.6s)
    this.el.style.transition = 'left 0.6s ease, top 0.6s ease';
    this.el.style.left = `${centerX}px`;
    this.el.style.top = `${centerY}px`;

    setTimeout(() => {
        // STEP 2: zoom in (besar)
        this.el.style.transition = 'transform 0.5s ease-in-out';
        this.el.style.transform = 'scale(2.5)';

        setTimeout(() => {
            // STEP 3: zoom out (kecil normal lagi)
            this.el.style.transition = 'transform 0.5s ease-in-out';
            this.el.style.transform = 'scale(1)';

            setTimeout(() => {
                // STEP 4: terbang ke album + mengecil
                this.el.style.transition = 'left 1s ease-in-out, top 1s ease-in-out, transform 1s ease-in-out, opacity 1s ease-in-out';
                this.el.style.left = `${targetX}px`;
                this.el.style.top = `${targetY}px`;
                this.el.style.transform = 'scale(0.25)';
                this.el.style.opacity = '0.8';

                setTimeout(() => {
                    try { this.el.remove(); } catch (e) {}
                    if (elements.albumModal && elements.albumModal.style.display === 'flex') {
                        showAlbum();
                    }
                }, 1000); // selesai terbang
            }, 500); // selesai zoom out
        }, 500); // selesai zoom in
    }, 600); // selesai gerak ke center
}

    setRotateAngle() {
        const angle = radToDeg(Math.atan2(this.y + this.h / 2 - this.clawPos.y, this.x + this.w / 2 - this.clawPos.x)) - 90;
        const adjustedAngle = Math.round(adjustAngle(angle));
        this.angle = adjustedAngle < 180 ? adjustedAngle * -1 : 360 - adjustedAngle;
        this.el.style.setProperty('--rotate-angle', `${this.angle}deg`);
    }
  }

  // World Objects Initialization
  const armJoint = new WorldObject({ className: 'arm-joint' });
  const vertRail = new WorldObject({ className: 'vert', moveWith: [null, armJoint] });
  const arm = new WorldObject({ className: 'arm' });

  // Initial setup
  elements.box.style.setProperty('--shadow-pos', `${maxArmLength}px`);
  armJoint.resizeShadow();

  armJoint.move({
      moveKey: 'y', target: machineTopHeight - machineBuffer.y, moveTime: 50,
      next: () => vertRail.resumeMove({
          moveKey: 'x', target: machineBuffer.x, moveTime: 50,
          next: () => {
              Object.assign(armJoint.default, { y: machineTopHeight - machineBuffer.y, x: machineBuffer.x });
              Object.assign(vertRail.default, { x: machineBuffer.x });
              checkCoinStatus();
          },
      }),
  });

  const doOverlap = (a, b) => b.x > a.x && b.x < a.x + a.w && b.y > a.y && b.y < a.y + a.h;

  const getClosestToy = () => {
      const claw = { y: armJoint.y + maxArmLength + machineBuffer.y + 7, x: armJoint.x + 7, w: 40, h: 32 };
      const overlappedToys = elements.toys.filter(t => doOverlap(t, claw) && !t.el.classList.contains('selected'));
      if (overlappedToys.length) {
          const toy = overlappedToys.sort((a, b) => b.index - a.index)[0];
          toy.setTransformOrigin({ x: claw.x - toy.x, y: claw.y - toy.y });
          toy.setClawPos({ x: claw.x, y: claw.y });
          settings.targetToy = toy;
      }
  };
  
  // Spawn Toys
  new Array(12).fill('').forEach((_, i) => {
    if (i === 8) return; 
    new Toy({ index: i });
  });

  // Game Flow Functions
  const stopHoriBtnAndActivateVertBtn = () => {
      armJoint.interval = null;
      horiBtn.deactivate();
      vertBtn.activate();
  };
  const activateHoriBtn = () => {
      checkCoinStatus();
      [vertRail, armJoint, arm].forEach(c => (c.interval = null));
  };
  const dropToy = () => {
    arm.el.classList.add('open');
    if (settings.targetToy) {
      settings.targetToy.z = 3;
      settings.targetToy.move({
        moveKey: 'y',
        target: machineHeight - settings.targetToy.h - 30,
        moveTime: 50,
      });
      [vertRail, armJoint, arm].forEach(obj => (obj.moveWith[0] = null));
    }
    setTimeout(() => {
      arm.el.classList.remove('open');
      activateHoriBtn();
      if (settings.targetToy) {
        settings.targetToy.el.classList.add('selected');
        elements.collectionArrow.classList.add('active');
        settings.targetToy = null;
      }
    }, 700);
  };
  const grabToy = () => {
    if (settings.targetToy) {
      [vertRail, armJoint, arm].forEach(obj => (obj.moveWith[0] = settings.targetToy));
      settings.targetToy.setRotateAngle();
      settings.targetToy.el.classList.add('grabbed');
    } else {
      arm.el.classList.add('missed');
    }
  };

  // Button Definitions
  const horiBtn = new Button({
      className: 'hori-btn',
      pressAction: () => {
          if (horiBtn.isLocked) return;
          if (!handlePlayAttempt()) return;
          arm.el.classList.remove('missed');
          vertRail.move({
              moveKey: 'x',
              target: machineWidth - armJoint.w - machineBuffer.x,
              next: stopHoriBtnAndActivateVertBtn,
          });
      },
      releaseAction: () => {
          if (vertRail.interval) {
              clearInterval(vertRail.interval);
              stopHoriBtnAndActivateVertBtn();
          }
      },
  });

  const vertBtn = new Button({
      className: 'vert-btn',
      pressAction: () => {
          if (vertBtn.isLocked) return;
          armJoint.move({ moveKey: 'y', target: machineBuffer.y });
      },
      releaseAction: () => {
          if (!armJoint.interval) return;
          clearInterval(armJoint.interval);
          vertBtn.deactivate();
          getClosestToy();
          setTimeout(() => {
              arm.el.classList.add('open');
              arm.move({
                  moveKey: 'h', target: maxArmLength,
                  next: () => setTimeout(() => {
                      arm.el.classList.remove('open');
                      grabToy();
                      arm.resumeMove({
                          moveKey: 'h',
                          next: () => vertRail.resumeMove({
                              moveKey: 'x',
                              next: () => armJoint.resumeMove({ moveKey: 'y', next: dropToy }),
                          }),
                      });
                  }, 500),
              });
          }, 500);
      },
  });
  
  // Keyboard Controls
  let isHoriKeyPressed = false;
  let isVertKeyPressed = false;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && !horiBtn.isLocked && !isHoriKeyPressed) {
        isHoriKeyPressed = true;
        horiBtn.pressAction();
    }
    if (e.key === 'ArrowUp' && !vertBtn.isLocked && !isVertKeyPressed) {
        isVertKeyPressed = true;
        vertBtn.pressAction();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' && isHoriKeyPressed) {
        isHoriKeyPressed = false;
        horiBtn.releaseAction();
    }
    if (e.key === 'ArrowUp' && isVertKeyPressed) {
        isVertKeyPressed = false;
        vertBtn.releaseAction();
    }
  });

  // Modal Logic
  function setupModals() {
    const closeBtns = document.querySelectorAll('.close-btn');
    closeBtns.forEach(btn => btn.addEventListener('click', () => {
        elements.albumModal.style.display = 'none';
        elements.missionModal.style.display = 'none';
    }));

    elements.albumBtn.addEventListener('click', showAlbum);
    elements.missionBtn.addEventListener('click', showMissions);

    // Event listener untuk tombol OK di notifikasi custom
    elements.customAlertOkBtn.addEventListener('click', () => {
        elements.customAlertModal.style.display = 'none';
    });
  }

  // Album Feature
  function showAlbum() {
      elements.albumGrid.innerHTML = '';
      for (const toyType in allToyTypes) {
          const slot = document.createElement('div');
          slot.className = 'album-slot';
          if (collectedToys.has(toyType)) {
              const img = document.createElement('div');
              img.className = `toy pix ${toyType}`;
              img.style.position = 'relative';
              img.style.width = '60px'; 
              img.style.height = '60px';
              slot.appendChild(img);
          } else {
              slot.textContent = '?';
          }
          elements.albumGrid.appendChild(slot);
      }
      elements.albumModal.style.display = 'flex';
  }

  // --- PERUBAHAN UTAMA: Logika Misi Diperbaiki Total ---
  const missionData = [
    { q: "Jika 2x - y = 8 dan x + 2y = 4, berapakah nilai dari 3x + y?", a: "12", r: 4 },
    { q: "Suku ke-5 dari barisan aritmetika adalah 18, dan suku ke-9 adalah 30. Tentukan suku ke-15.", a: "48", r: 10 },
    { q: "Pekerjaan diselesaikan A dalam 10 hari dan B dalam 15 hari. Jika kerja bersama, berapa hari selesai?", a: "6", r: 4 },
    { q: "Beli 20 kg jeruk Rp180.000. 10% busuk. Jika ingin untung Rp30.000, berapa harga jual per kg? (tanpa titik)", a: "11667", r: 10 },
    { q: "Arya (60km/jam) & Bima (40km/jam) berangkat pukul 07.00 dari kota A & B (jarak 300km). Pukul berapa mereka bertemu? (format: 10.00)", a: "10.00", r: 6 },
    { q: "A:B = 3:4 dan B:C = 2:5. Jika nilai A adalah 12, berapakah nilai C?", a: "40", r: 4 },
    { q: "Total 13 hewan (ayam & kambing). Total kaki 38. Berapa banyak kambing?", a: "6", r: 4 },
  ];
  let currentMissions = [];
  let activeMissionIndex = null;

  // 隼 Fungsi kontrol tombol submit
function updateSubmitStatus() {
    if (activeMissionIndex === null) {
        missionElements.submitBtn.disabled = true;
        missionElements.submitBtn.style.opacity = "0.5"; // efek visual
        missionElements.submitBtn.style.pointerEvents = "none";
    } else {
        missionElements.submitBtn.disabled = false;
        missionElements.submitBtn.style.opacity = "1";
        missionElements.submitBtn.style.pointerEvents = "auto";
    }
}

  
  const missionElements = {
    selectionView: document.getElementById('mission-selection-view'),
    questionView: document.getElementById('mission-question-view'),
    heartsContainer: document.getElementById('mission-hearts'),
    resetBtn: document.getElementById('reset-mission-btn'),
    questionText: document.getElementById('mission-question-text'),
    answerInput: document.getElementById('mission-answer-input'),
    submitBtn: document.getElementById('submit-mission-btn'),
  };

let usedMissions = new Set(); // simpan soal yang sudah pernah keluar

function generateMissions() {
    // ambil semua soal
    const availableMissions = missionData.map(m => ({...m, completed: false}));

    // acak
    const shuffled = availableMissions.sort(() => 0.5 - Math.random());

    // ambil 3 soal unik
    currentMissions = shuffled.slice(0, 3);
}



  function showMissions() {
    if (currentMissions.length === 0 || currentMissions.every(m => m.completed)) {
        generateMissions();
    }
    renderMissionSelection();
    elements.missionModal.style.display = 'flex';
  }

  function renderMissionSelection() {
    missionElements.heartsContainer.innerHTML = '';
    currentMissions.forEach((mission, index) => {
        if (!mission.completed) {
            const heart = document.createElement('img');
            heart.src = 'LEVEL.png';
            heart.className = 'mission-level';
            // Simpan index misi di elemen untuk diambil nanti
            heart.dataset.missionIndex = index;
            missionElements.heartsContainer.appendChild(heart);
        }
    });
    missionElements.selectionView.style.display = 'flex';
    missionElements.questionView.style.display = 'none';
  }

  function startMission(missionIndex) {
      activeMissionIndex = missionIndex;
      const mission = currentMissions[missionIndex];
      missionElements.questionText.textContent = mission.q;
      missionElements.answerInput.value = '';
      missionElements.selectionView.style.display = 'none';
      missionElements.questionView.style.display = 'flex';
      missionElements.answerInput.focus();
       updateSubmitStatus(); // 隼 aktifkan tombol submit
  }
  
  function handleSubmitAnswer() {
    if (activeMissionIndex === null) return;
     updateSubmitStatus(); // 隼 matikan tombol submit

    const mission = currentMissions[activeMissionIndex];
    const userAnswer = missionElements.answerInput.value.trim();

    if (userAnswer.toLowerCase() === mission.a.toLowerCase()) {
        showCustomAlert(`Jawaban Benar! Kamu mendapatkan ${mission.r} koin.`);
        coins += mission.r;
        updateCoinDisplay();
        mission.completed = true;
    } else {
        showCustomAlert('Jawaban Salah. Coba lagi lain kali!');
    }

    activeMissionIndex = null;
    if (currentMissions.every(m => m.completed)) {
        showCustomAlert("Selamat! Semua misi sesi ini selesai. Misi baru akan dibuat.");
        generateMissions();
    }
    renderMissionSelection();
  }
  
  // FIX: Menggunakan event delegation untuk klik hati yang lebih stabil
  missionElements.heartsContainer.addEventListener('click', (event) => {
      const target = event.target;
      if (target.classList.contains('mission-level')) {
          const missionIndex = parseInt(target.dataset.missionIndex, 10);
          startMission(missionIndex);
      }
  });

  // FIX: Listener untuk tombol submit dan reset dipasang sekali dan permanen
  missionElements.submitBtn.addEventListener('click', handleSubmitAnswer);
 missionElements.resetBtn.addEventListener('click', () => {
    if (coins >= 2) {
        coins -= 2;
        updateCoinDisplay();
        showCustomAlert("Misi di-reset! Soal baru diambil.");
        generateMissions(); // ambil soal baru
        renderMissionSelection();
    } else {
        showCustomAlert("Koin tidak cukup untuk reset misi.");
    }
});


  // Initial Game Setup
  updateCoinDisplay();
  setupModals();
  updateSubmitStatus(); // 隼 awalnya tombol submit dimatikan

  // --- NEW MUSIC LOGIC ---
  window.addEventListener("DOMContentLoaded", () => {
      const bgMusic = document.getElementById("bg-music");
      const onOffBtn = document.getElementById("music-toggle-onoff");
      const onOffImg = onOffBtn.querySelector('img');
      const selectToyBtn = document.getElementById("music-select-toy");
      const selectIceBtn = document.getElementById("music-select-ice");

      if (!bgMusic || !onOffBtn || !selectToyBtn || !selectIceBtn) return;

      let isMusicOn = false; // Start with music off
      const tracks = {
          toy: 'toyland.mp3',
          ice: 'ice.mp3'
      };

      bgMusic.volume = 0.5;
      bgMusic.src = tracks.toy; // Pre-load default track

      function updateSelectedVisual(selectedButton) {
          selectToyBtn.classList.remove('selected');
          selectIceBtn.classList.remove('selected');
          selectedButton.classList.add('selected');
      }

      onOffBtn.addEventListener('click', () => {
          isMusicOn = !isMusicOn;
          if (isMusicOn) {
              bgMusic.play().catch(e => console.error("Playback failed:", e));
              onOffImg.src = 'aktif.png';
          } else {
              bgMusic.pause();
              onOffImg.src = 'mute.png';
          }
      });

      selectToyBtn.addEventListener('click', () => {
          bgMusic.src = tracks.toy;
          if (isMusicOn) {
              bgMusic.play();
          }
          updateSelectedVisual(selectToyBtn);
      });

      selectIceBtn.addEventListener('click', () => {
          bgMusic.src = tracks.ice;
          if (isMusicOn) {
              bgMusic.play();
          }
          updateSelectedVisual(selectIceBtn);
      });
  });

});