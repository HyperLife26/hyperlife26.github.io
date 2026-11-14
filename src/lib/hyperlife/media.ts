import avatarMale from "@/assets/avatar-male.jpg";
import avatarFemale from "@/assets/avatar-female.jpg";
import avatarAlien from "@/assets/avatar-alien.jpg";
import envMoon from "@/assets/env-moon.jpg";
import envMars from "@/assets/env-mars.jpg";
import envShip from "@/assets/env-ship.jpg";
import type { AvatarKind, EnvironmentKind } from "./types";

export const AVATAR_IMG: Record<AvatarKind, string> = {
  male: avatarMale,
  female: avatarFemale,
  alien: avatarAlien,
};

export const ENV_IMG: Record<EnvironmentKind, string> = {
  moon: envMoon,
  mars: envMars,
  ship: envShip,
};
