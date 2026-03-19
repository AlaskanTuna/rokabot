import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from '@discordjs/builders'
import { MessageFlags } from 'discord.js'
import type { ToneKey } from '../agent/prompts/tones.js'
import { getToneStyle } from './toneStyles.js'

export function buildRokaMessage(text: string, tone: ToneKey) {
  const style = getToneStyle(tone)

  const container = new ContainerBuilder()
    .setAccentColor(style.color)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
        .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: style.imageUrl } }))
    )

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
  }
}
