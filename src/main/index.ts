import {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    shell,
    Menu,
    MenuItemConstructorOptions,
} from "electron";
import { readFile, writeFile } from "fs/promises";
import { join, basename } from "path";

type MarkdownFile = {
    content?: string;
    filePath?: string;
};

let currentFile: MarkdownFile = {
    content: "",
    filePath: undefined,
};

const getCurrentFile = async (browserWindow?: BrowserWindow) => {
    if (currentFile.filePath) return currentFile.filePath;
    if (!browserWindow) return;
    return showSaveDialog(browserWindow);
};

const setCurrentFile = (
    browserWindow: BrowserWindow,
    filePath: string,
    content: string
) => {
    currentFile.content = content;
    currentFile.filePath = filePath;

    app.addRecentDocument(filePath);
    browserWindow.setTitle(`${basename(filePath)} - ${app.name}`);
    browserWindow.setRepresentedFilename(filePath);
};

const hasChanged = (content: string) => {
    return currentFile.content !== content;
};

ipcMain.handle("has-changed", (event, content: string) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    const changed = hasChanged(content);
    browserWindow?.setDocumentEdited(changed);
    return changed;
});

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        show: false,
        center: true,
        transparent: true,
        icon: "../icons/firesaleTemplate.png",
        // autoHideMenuBar: true,
        titleBarStyle: "customButtonsOnHover",
        webPreferences: {
            preload: join(__dirname, "preload.js"),
        },
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(
            join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
        );
    }

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
        mainWindow.focus();
    });

    // mainWindow.webContents.openDevTools({
    //     mode: "detach",
    // });
    return mainWindow;
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

const showOpenDialog = async (browserWindow: BrowserWindow) => {
    const result = await dialog.showOpenDialog(browserWindow, {
        properties: ["openFile"],
        filters: [{ name: "Markdown File", extensions: ["md"] }],
    });

    if (result.canceled) return;
    const [filePath] = result.filePaths;

    openFile(browserWindow, filePath);
};

const openFile = async (browserWindow: BrowserWindow, filePath: string) => {
    const content = await readFile(filePath, { encoding: "utf-8" });
    setCurrentFile(browserWindow, filePath, content);
    browserWindow.webContents.send("file-opened", content, filePath);
};

const showExportHtmlDialog = async (
    browserWindow: BrowserWindow,
    html: string
) => {
    const result = await dialog.showSaveDialog(browserWindow, {
        title: "Export Html",
        filters: [{ name: "HTML File", extensions: ["html"] }],
    });

    if (result.canceled) return;

    const { filePath } = result;
    if (!filePath) return;

    exportHtml(filePath, html);
};

const exportHtml = async (filePath: string, html: string) => {
    await writeFile(filePath, html, { encoding: "utf-8" });
};

ipcMain.on("show-open-dialog", (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) return;

    showOpenDialog(browserWindow);
});

ipcMain.on("show-export-html-dialog", async (event, html: string) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) return;
    showExportHtmlDialog(browserWindow, html);
});

const showSaveDialog = async (browserWindow: BrowserWindow) => {
    const result = await dialog.showSaveDialog(browserWindow, {
        title: "Save File",
        filters: [{ name: "Markdown File", extensions: ["md"] }],
    });

    if (result.canceled) return;

    const { filePath } = result;
    if (!filePath) return;

    return filePath;
};

const saveFile = async (browserWindow: BrowserWindow, content: string) => {
    const filePath = await getCurrentFile(browserWindow);
    if (!filePath) return;

    setCurrentFile(browserWindow, filePath, content);
    await writeFile(filePath, content, { encoding: "utf-8" });
};

ipcMain.on("save-file", async (event, content: string) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow) return;
    await saveFile(browserWindow, content);
});

ipcMain.on("show-in-file-system", async () => {
    if (currentFile.filePath) {
        await shell.showItemInFolder(currentFile.filePath);
    }
});

ipcMain.on("open-in-default", async () => {
    if (currentFile.filePath) {
        await shell.openPath(currentFile.filePath);
    }
});

const template: MenuItemConstructorOptions[] = [
    {
        label: "File",
        submenu: [
            {
                label: "Open",
                click: () => {
                    let browserWindow = BrowserWindow.getFocusedWindow();
                    if (!browserWindow) browserWindow = createWindow();
                    showOpenDialog(browserWindow);
                },
                accelerator: "CmdOrCtrl+O",
            },
            {
                label: "Quit",
                role: "quit",
            },
        ],
    },
    {
        label: "Edit",
        role: "editMenu"
    },
];

if (process.platform === 'darwin') {
    template.unshift({
        label: app.name,
        role: "appMenu"
    })
}

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)