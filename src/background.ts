import {app,BrowserWindow} from 'electron'
import * as process from "process";
app.whenReady().then(()=>{
    const win=new BrowserWindow({
        width:800,
        height:600,
        webPreferences:{
            nodeIntegration:true, // 是否集成 Nodejs
            contextIsolation:false, // 上下文隔离
            webSecurity:false, // 禁用同源策略
        }
    })
    const address=process.argv[2]
    if(address){
        // dev
        win.loadURL(address)
        win.webContents.openDevTools()
    }else{
        // build
        win.loadFile('index.html')
    }
})
