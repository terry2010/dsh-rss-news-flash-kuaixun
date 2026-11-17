#!/usr/bin/env node
/** 构建期资产拷贝：sources.flash.json + web/ → lib/（与编译产物同目录，运行期按 import.meta.url 读） */
import { mkdirSync, copyFileSync, cpSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
mkdirSync(join(root, 'lib'), { recursive: true })
copyFileSync(join(root, 'src/sources.flash.json'), join(root, 'lib/sources.flash.json'))
copyFileSync(join(root, 'src/client.js'), join(root, 'lib/client.js'))
cpSync(join(root, 'web'), join(root, 'lib/web'), { recursive: true })
console.log('copied: src/sources.flash.json -> lib/')
console.log('copied: src/client.js -> lib/')
console.log('copied: web/ -> lib/web/')
