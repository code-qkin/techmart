import React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  SmartPhone01Icon,
  LaptopIcon,
  Tablet01Icon,
  AiSmartwatchIcon,
  Airpod01Icon,
  HeadphonesIcon,
  GameController01Icon,
  Speaker01Icon,
  Mouse01Icon,
  KeyboardIcon,
  CableIcon,
  Package01Icon,
} from '@hugeicons/core-free-icons'

export const getProductIcon = (
  category: string,
  name: string = '',
  size: number = 24,
  className?: string,
): React.ReactElement => {
  const props = { size, className }
  const n = name.toLowerCase()

  if (category === 'Phones') return <HugeiconsIcon {...props} icon={SmartPhone01Icon} />
  if (category === 'Laptops') return <HugeiconsIcon {...props} icon={LaptopIcon} />
  if (category === 'Tablets') return <HugeiconsIcon {...props} icon={Tablet01Icon} />

  if (n.includes('watch')) return <HugeiconsIcon {...props} icon={AiSmartwatchIcon} />
  if (n.includes('airpod') || n.includes('earpod') || n.includes('earbud')) return <HugeiconsIcon {...props} icon={Airpod01Icon} />
  if (n.includes('headphone') || n.includes('earphone')) return <HugeiconsIcon {...props} icon={HeadphonesIcon} />
  if (n.includes('game') || n.includes('controller') || n.includes('joystick')) return <HugeiconsIcon {...props} icon={GameController01Icon} />
  if (n.includes('speaker') || n.includes('woofer')) return <HugeiconsIcon {...props} icon={Speaker01Icon} />
  if (n.includes('mouse')) return <HugeiconsIcon {...props} icon={Mouse01Icon} />
  if (n.includes('keyboard')) return <HugeiconsIcon {...props} icon={KeyboardIcon} />
  if (n.includes('cable') || n.includes('charger') || n.includes('adapter') || n.includes('usb')) return <HugeiconsIcon {...props} icon={CableIcon} />

  return <HugeiconsIcon {...props} icon={Package01Icon} />
}
