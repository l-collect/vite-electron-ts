import type {Plugin, ResolvedConfig} from "vite";
import fs from 'fs'
import type {AddressInfo} from "node:net";
import type {CliOptions} from 'electron-builder'
import * as electronBuilder from 'electron-builder'
import {spawn, ChildProcessWithoutNullStreams} from 'child_process'
import * as path from "path";

/**
 * 深度合并对象
 */
function deepMerge<T extends object>(base: T, source: T) {
    for (const key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) {
            if (typeof base[key] === 'object' && base[key] !== null) {
                deepMerge(base[key] as object, source[key] as object)
            } else {
                base[key] = source[key]
            }
        } else {
            base[key] = source[key]
        }
    }
    return base
}

/** vite-electron-loader配置 */
export type ViteElectronLoaderOptions = {
    /** 主进程入口文件 默认：src/background.ts */
    entry: string
    /** 是否将主进程编译成一个文件 默认：true */
    bundle: boolean
    /** 编译目标 默认：node14 */
    target: string
    /** 编译平台 默认：node */
    platform: string
    /** 外部依赖 默认：['electron'] */
    externals: string[]
    /** electron-builder配置 */
    build: CliOptions
}
let globalConfig:ResolvedConfig;
// 编译background.ts成background.js
function buildBackground(config: ViteElectronLoaderOptions) {
    const entryFileName = path.basename(config.entry, '.ts');
    require('esbuild').buildSync({
        entryPoints: [config.entry],
        bundle: config.bundle ?? true,
        outfile: `${globalConfig.build.outDir}/${entryFileName}.js`,
        platform: config.platform ?? 'node',
        target: config.target ?? 'node14',
        external: config.externals ?? ['electron'],
    })
}

const defaultOptions: ViteElectronLoaderOptions = {
    entry: 'src/background.ts',
    bundle: true,
    target: 'node14',
    platform: 'node',
    externals: ['electron'],
    build: {
        config: {
            directories: {
                output: path.resolve(process.cwd(), 'release'),
                app: path.resolve(process.cwd(), 'dist'),
            },
            asar: true,
            appId: 'com.example.app',
            productName: 'example',
            nsis: {
                oneClick: false,
                allowToChangeInstallationDirectory: true,
            }
        }
    }
}
/**
 * vite 的 electron 同步加载、打包插件
 * @param options {ViteElectronLoaderOptions} 配置
 * @returns {Plugin}
 */
export default function electronLoader(options?: Partial<ViteElectronLoaderOptions>): Plugin {
    if(!options) options = {}
    const newOptions = deepMerge(defaultOptions, options) as ViteElectronLoaderOptions
    return {
        name: "vite-electron-loader",
        configResolved(config) {
            globalConfig = config;
        },
        configureServer(server) {
            buildBackground(newOptions);
            let cp: ChildProcessWithoutNullStreams | undefined;
            const entryFileName = path.basename(newOptions.entry, '.ts');
            server?.httpServer?.on('listening', () => {
                const addressInfo = server?.httpServer?.address() as AddressInfo;
                const ipAddr = `http://localhost:${addressInfo.port}`;
                cp = spawn('electron', [`${globalConfig.build.outDir}/${entryFileName}.js`, ipAddr])
                fs.watchFile(newOptions.entry, () => {
                    buildBackground(newOptions);
                    cp?.kill();
                    cp = spawn('electron', [`${globalConfig.build.outDir}/${entryFileName}.js`, ipAddr])
                })
            });
            server?.httpServer?.on('close', () => {
                cp?.kill()
            })
        },
        closeBundle() {
            if(globalConfig.env.NODE_ENV !== 'production') return;
            buildBackground(newOptions);
            const entryFileName = path.basename(newOptions.entry, '.ts');
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
            packageJson.main = `${entryFileName}.js`;
            fs.writeFileSync(`${globalConfig.build.outDir}/package.json`, JSON.stringify(packageJson, null, 2));
            // electron-builder bug
            fs.mkdirSync(`${globalConfig.build.outDir}/node_modules`, {recursive: true});
            electronBuilder.build(newOptions.build)
        }
    }
}
