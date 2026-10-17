export const SOUND_GROUPS={rock:['pick-rock-1','pick-rock-2','pick-rock-3'],pickMetal:['pick-metal-1','pick-metal-2'],crystal:['pick-crystal-1','pick-crystal-2']};
export const SOUND_ASSETS=Object.fromEntries([
  ...SOUND_GROUPS.rock.map(id=>[id,.75]),...SOUND_GROUPS.pickMetal.map(id=>[id,.7]),...SOUND_GROUPS.crystal.map(id=>[id,.66]),
  ['rock-break',.8],['ore-gold',.7],['ore-cyan',.64],['ore-violet',.64],['deposit',.72],['refill',.52],
  ['gas-enter',.42],['gas-loop',.18,true],['air-low',.55],['breath-loop',.22,true],['lift',.52],['rescue',.7],['down',.5],
  ['start',.6],['quota',.62],['win',.66],['lose',.5],['radio',.32],['cave-loop',.12,true],['ui',.25]
].map(([id,gain,loop=false])=>[id,{file:`assets/sfx/${id}.wav`,gain,loop}]));
