import { _decorator, Component } from "cc";
import { HERO_CLASSES } from "../shared/contracts/index";

const { ccclass } = _decorator;

@ccclass("SharedContractsSmoke")
export class SharedContractsSmoke extends Component {
  protected onLoad(): void {
    console.info(`[DrawBorn] shared contracts loaded: ${HERO_CLASSES.join(",")}`);
  }
}
