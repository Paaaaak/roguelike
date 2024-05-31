import Phaser from "phaser";
import Player from "../characters/Player";
import { setBackground } from "../utils/backgroundManager";
import Config from "../Config";
import { addMobEvent } from "../utils/mobManager";
import { addAttackEvent } from "../utils/attackManager";
import Mob from "../characters/Mob";

export default class PlayingScene extends Phaser.Scene {
  constructor() {
    super("playGame");
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

    // 마우스 클릭 이벤트 리스너 추가
    this.input.on('pointerdown', this.onMouseClick, this);

    // m_mobs는 physics group으로, 속한 모든 오브젝트에 동일한 물리법칙을 적옹할 수 있습니다.
    // m_mobEvents는 mob event의 timer를 담을 배열로, mob event를 추가 및 제거할 때 사용할 것입니다.
    // addMobEvent는 m_mobEvents에 mob event의 timer를 추가해줍니다.
    this.m_mobs = this.physics.add.group();
    this.m_mobEvents = [];
    // scene, repeatGap, mobTexture, mobAnim, mobHp, mobDropRate
    addMobEvent(this, 1000, "mob1", "mob1_anim", 10, 0.9);

    // mobs
    this.m_mobs = this.physics.add.group();
    // 맨 처음에 등장하는 몹을 수동으로 추가해줍니다.
    // 추가하지 않으면 closest mob을 찾는 부분에서 에러가 발생합니다.
    this.m_mobs.add(new Mob(this, 0, 0, "mob1", "mob1_anim", 10));
    this.m_mobEvents = [];
    addMobEvent(this, 1000, "mob1", "mob1_anim", 10, 0.9);

    // attacks
    // 정적인 공격과 동적인 공격의 동작 방식이 다르므로 따로 group을 만들어줍니다.
    // attack event를 저장하는 객체도 멤버 변수로 만들어줍니다.
    // 이는 공격 강화등에 활용될 것입니다.
    this.m_weaponDynamic = this.add.group();
    this.m_weaponStatic = this.add.group();
    this.m_attackEvents = {};
    // PlayingScene이 실행되면 바로 beam attack event를 추가해줍니다.
    addAttackEvent(this, "beam", 10, 1, 1000);
  }

  update() {
    this.movePlayerManager();

    // camera가 가는 곳으로 background가 따라 움직이도록 해줍니다.
    this.m_background.setX(this.m_player.x - Config.width / 2);
    this.m_background.setY(this.m_player.y - Config.height / 2);

    // tilePosition을 player가 움직이는 만큼 이동시켜 마치 무한 배경인 것처럼 나타내 줍니다.
    this.m_background.tilePositionX = this.m_player.x - Config.width / 2;
    this.m_background.tilePositionY = this.m_player.y - Config.height / 2;

    // player로부터 가장 가까운 mob을 구합니다.
    // 가장 가까운 mob은 mob, player의 움직임에 따라 계속 바뀌므로 update 내에서 구해야 합니다.
    // getChildren: group에 속한 모든 객체들의 배열을 리턴하는 메소드입니다.
    const closest = this.physics.closest(
      this.m_player,
      this.m_mobs.getChildren()
    );
    this.m_closest = closest;
  }

  onMouseClick(pointer) {
    // 클릭한 위치의 좌표를 출력합니다.
    console.log('Mouse clicked at: ', pointer.x, pointer.y);

    // 클릭한 위치에 텍스트를 표시합니다.
    this.add.text(pointer.x, pointer.y, `(${pointer.x}, ${pointer.y})`, { color: '#ff0000', fontSize: '16px' }).setOrigin(0.5, 0.5);
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
  }
}
