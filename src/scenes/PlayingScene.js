import Phaser from "phaser";
import Player from "../characters/Player";
import { setBackground } from "../utils/backgroundManager";
import Config from "../Config";
import { addAttackEvent } from "../utils/attackManager";
import Mob from "../characters/Mob";
import TopBar from "../ui/TopBar";
import ExpBar from "../ui/ExpBar";
import { pause } from "../utils/pauseManager";
import { addMobEvent, removeOldestMobEvent } from "../utils/mobManager";

export default class PlayingScene extends Phaser.Scene {
  constructor() {
    super("playGame");
    this.isMousePressed = false; // Flag to track mouse state
  }

  create() {
    // 사용할 sound들을 추가해놓는 부분입니다.
    // load는 전역적으로 어떤 scene에서든 asset을 사용할 수 있도록 load 해주는 것이고,
    // add는 해당 scene에서 사용할 수 있도록 scene의 멤버 변수로 추가할 때 사용하는 것입니다.
    this.sound.pauseOnBlur = false;
    this.m_beamSound = this.sound.add("audio_beam");
    this.m_scratchSound = this.sound.add("audio_scratch");
    this.m_hitMobSound = this.sound.add("audio_hitMob");
    this.m_growlSound = this.sound.add("audio_growl");
    this.m_explosionSound = this.sound.add("audio_explosion");
    this.m_expUpSound = this.sound.add("audio_expUp");
    this.m_hurtSound = this.sound.add("audio_hurt");
    this.m_nextLevelSound = this.sound.add("audio_nextLevel");
    this.m_gameOverSound = this.sound.add("audio_gameOver");
    this.m_gameClearSound = this.sound.add("audio_gameClear");
    this.m_pauseInSound = this.sound.add("audio_pauseIn");
    this.m_pauseOutSound = this.sound.add("audio_pauseOut");

    // player를 m_player라는 멤버 변수로 추가합니다.
    this.m_player = new Player(this);

    // camera가 player를 따라오도록 하여 뱀파이어 서바이벌처럼 player가 가운데 고정되도록 합니다.
    this.cameras.main.startFollow(this.m_player);

    // PlayingScene의 background를 설정합니다.
    setBackground(this, "background1");

    // 키보드 키를 m_cursorKeys라는 멤버 변수로 추가해줍니다.
    this.m_cursorKeys = this.input.keyboard.createCursorKeys();

    // Initialize the WASD keys
    this.m_wasdKeys = {
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.input.on('pointerdown', this.onMouseDown, this);
    this.input.on('pointerup', this.onMouseUp, this);

    // m_mobs는 physics group으로, 속한 모든 오브젝트에 동일한 물리법칙을 적옹할 수 있습니다.
    // m_mobEvents는 mob event의 timer를 담을 배열로, mob event를 추가 및 제거할 때 사용할 것입니다.
    // addMobEvent는 m_mobEvents에 mob event의 timer를 추가해줍니다.
    this.m_mobs = this.physics.add.group();
    this.m_mobEvents = [];
    addMobEvent(this, 1000, "mob1", "mob1_anim", 109, 0.9);

    // mobs
    this.m_mobs = this.physics.add.group();
    // 맨 처음에 등장하는 몹을 수동으로 추가해줍니다.
    // 추가하지 않으면 closest mob을 찾는 부분에서 에러가 발생합니다.
    this.m_mobs.add(new Mob(this, 0, 0, "mob1", "mob1_anim", 10));
    this.m_mobEvents = [];
    addMobEvent(this, 1000, "mob1", "mob1_anim", 109, 0.9);

    // attacks
    // 정적인 공격과 동적인 공격의 동작 방식이 다르므로 따로 group을 만들어줍니다.
    // attack event를 저장하는 객체도 멤버 변수로 만들어줍니다.
    // 이는 공격 강화등에 활용될 것입니다.
    this.m_weaponDynamic = this.add.group();
    this.m_weaponStatic = this.add.group();
    this.m_attackEvents = {};

    // collisions
    /**
     * 어떤 오브젝트들이 충돌했을 때 동작을 발생시키려면 physics.add.overlap 함수를 사용합니다.
     * @param object1 오버랩되는지 검사할 오브젝트 1
     * @param object2 오버랩되는지 검사할 오브젝트 2
     * @param collideCallback 오브젝트 1과 오브젝트 2가 충돌하면 실행될 콜백함수입니다.
     * @param processCallback 두 오브젝트가 겹치는 경우 추가 검사를 수행할 수 있는 선택적 콜백 함수입니다. 이것이 설정되면 이 콜백이 true를 반환하는 경우에만 collideCallback이 호출됩니다.
     * @param callbackContext 콜백 스코프입니다. (this를 사용하시면 됩니다.)
     */

    // Player와 mob이 부딪혔을 경우 player에 데미지 10을 줍니다.
    // (Player.js에서 hitByMob 함수 확인)
    this.physics.add.overlap(
      this.m_player,
      this.m_mobs,
      () => this.m_player.hitByMob(10),
      null,
      this
    );

    // mob이 dynamic 공격에 부딪혓을 경우 mob에 해당 공격의 데미지만큼 데미지를 줍니다.
    // (Mob.js에서 hitByDynamic 함수 확인)
    this.physics.add.overlap(
      this.m_weaponDynamic,
      this.m_mobs,
      (weapon, mob) => {
        mob.hitByDynamic(weapon, weapon.m_damage, this.m_mobs);
      },
      null,
      this
    );

    // mob이 static 공격에 부딪혓을 경우 mob에 해당 공격의 데미지만큼 데미지를 줍니다.
    // (Mob.js에서 hitByStatic 함수 확인)
    this.physics.add.overlap(
      this.m_weaponStatic,
      this.m_mobs,
      (weapon, mob) => {
        mob.hitByStatic(weapon.m_damage);
      },
      null,
      this
    );

    // exp up item들을 담을 physics group을 추가해줍니다.
    this.m_expUps = this.physics.add.group();

    // player와 expUp이 접촉했을 때 pickExpUp 메소드가 동작하도록 합니다.
    this.physics.add.overlap(
      this.m_player,
      this.m_expUps,
      this.pickExpUp,
      null,
      this
    );

    // topBar, expBar를 PlayingScene에 추가해줍니다. 
    // 맨 처음 maxExp는 50으로 설정해줍니다.
    this.m_topBar = new TopBar(this);
    this.m_expBar = new ExpBar(this, 50);

    this.input.keyboard.on(
      "keydown-ESC",
      () => { pause(this, "pause"); },
      this
    );
  }

  update() {
    this.movePlayerManager();

    // camera가 가는 곳으로 background가 따라 움직이도록 해줍니다.
    this.m_background.setX(this.m_player.x - Config.width / 2);
    this.m_background.setY(this.m_player.y - Config.height / 2);

    // tilePosition을 player가 움직이는 만큼 이동시켜 마치 무한 배경인 것처럼 나타내 줍니다.
    this.m_background.tilePositionX = this.m_player.x - Config.width / 2;
    this.m_background.tilePositionY = this.m_player.y - Config.height / 2;

    if (this.isMousePressed) {
      const pointer = this.input.activePointer;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      this.m_click_coordinate = {
        x: worldPoint.x,
        y: worldPoint.y
      };

      if (!this.attackTimer) {
        this.attackTimer = this.time.addEvent({
          delay: 150,
          callback: this.handleContinuousAttack,
          callbackScope: this,
          loop: true
        });
      }
    } else {
      if (this.attackTimer) {
        this.attackTimer.destroy();
        this.attackTimer = null;
      }
    }
  }

  onMouseDown(pointer) {
    this.isMousePressed = true;
    this.handleMouseClick(pointer);
  }

  onMouseUp(pointer) {
    this.isMousePressed = false;
  }

  handleMouseClick(pointer) {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.m_click_coordinate = {
      x: worldPoint.x,
      y: worldPoint.y
    };
    addAttackEvent(this, "beam", 10, 1);
  }

  handleContinuousAttack() {
    addAttackEvent(this, "beam", 10, 1);
  }

  // player가 움직이도록 해주는 메소드입니다.
  movePlayerManager() {
    // 이동 키가 눌려있으면 player가 걸어다니는 애니메이션을 재생하고,
    // 이동 키가 눌려있지 않으면 player가 가만히 있도록 합니다.
    if (
      this.m_cursorKeys.left.isDown ||
      this.m_wasdKeys.left.isDown ||
      this.m_cursorKeys.up.isDown ||
      this.m_wasdKeys.up.isDown ||
      this.m_cursorKeys.right.isDown ||
      this.m_wasdKeys.right.isDown ||
      this.m_cursorKeys.down.isDown ||
      this.m_wasdKeys.down.isDown
    ) {
      if (!this.m_player.m_moving) {
        this.m_player.play("player_anim");
      }
      this.m_player.m_moving = true;
    } else {
      if (this.m_player.m_moving) {
        this.m_player.play("player_idle");
      }
      this.m_player.m_moving = false;
    }

    // vector를 사용해 움직임을 관리할 것입니다.
    // vector = [x좌표 방향, y좌표 방향]입니다.
    // 왼쪽 키가 눌려있을 때는 vector[0] += -1, 오른쪽 키가 눌려있을 때는 vector[0] += 1을 해줍니다.
    // 위/아래 또한 같은 방법으로 벡터를 수정해줍니다.
    let vector = [0, 0];
    if (this.m_cursorKeys.left.isDown || this.m_wasdKeys.left.isDown) {
      // player.x -= PLAYER_SPEED; // 공개영상에서 진행했던 것
      vector[0] += -1;
    } else if (this.m_cursorKeys.right.isDown || this.m_wasdKeys.right.isDown) {
      vector[0] += 1;
    }
    if (this.m_cursorKeys.up.isDown || this.m_wasdKeys.up.isDown) {
      vector[1] += -1;
    } else if (this.m_cursorKeys.down.isDown || this.m_wasdKeys.down.isDown) {
      vector[1] += 1;
    }

    // vector를 player 클래스의 메소드의 파라미터로 넘겨줍니다.
    this.m_player.move(vector);

    // static 공격들은 player가 이동하면 그대로 따라오도록 해줍니다.
    this.m_weaponStatic.children.each(weapon => {
      weapon.move(vector);
    }, this);
  }

  // player와 expUp이 접촉했을 때 실행되는 메소드입니다.
  pickExpUp(player, expUp) {
    // expUp을 비활성화하고 화면에 보이지 않게 합니다.
    expUp.disableBody(true, true);
    // expUp을 제거합니다.
    expUp.destroy();

    // 소리를 재생합니다.
    this.m_expUpSound.play();
    // expUp item을 먹으면 expBar의 경험치를 아이템의 m_exp 값만큼 증가시켜줍니다.
    this.m_expBar.increase(expUp.m_exp);
    if (this.m_expBar.m_currentExp >= this.m_expBar.m_maxExp) {
      // maxExp를 초과하면 레벨업을 해주던 기존의 코드를 지우고
      // afterLevelUp 메소드를 만들어 거기에 옮겨줍니다.
      // 추후 레벨에 따른 몹, 무기 추가를 afterLevelUp에서 실행해 줄 것입니다.
      pause(this, "levelup");
    }
  }

  afterLevelUp() {
    this.m_topBar.gainLevel();

    // 레벨이 2, 3, 4, ..가 되면 등장하는 몹을 변경해줍니다.
    // 이전 몹 이벤트를 지우지 않으면 난이도가 너무 어려워지기 때문에 이전 몹 이벤트를 지워줍니다.
    // 레벨이 높아질 수록 강하고 아이텝 드랍율이 낮은 몹을 등장시킵니다.
    // repeatGap은 동일하게 설정했지만 레벨이 올라갈수록 더 짧아지도록 조절하셔도 됩니다.
    // switch (this.m_topBar.m_level) {
    //   case 2:
    //     removeOldestMobEvent(this);
    //     addMobEvent(this, 1000, "mob2", "mob2_anim", 20, 0.8);
    //     break;
    //   case 3:
    //     removeOldestMobEvent(this);
    //     addMobEvent(this, 1000, "mob3", "mob3_anim", 30, 0.7);
    //     break;
    //   case 4:
    //     removeOldestMobEvent(this);
    //     addMobEvent(this, 1000, "mob4", "mob4_anim", 40, 0.7);
    //     break;
    // }
  }
}
