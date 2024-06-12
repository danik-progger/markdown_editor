import { ipcRenderer, contextBridge } from "electron";
import Elements from "./renderer/elements";
import { renderMarkdown } from "./renderer/markdown";

ipcRenderer.on("file-opened", (_, content: string) => {
    Elements.MarkdownView.value = content;
    renderMarkdown(content);
});

contextBridge.exposeInMainWorld("api", {
    onFileOpen: (callback: (content: string) => void) => {
        ipcRenderer.on("file-opened", (_, content: string) => {
            callback(content);
        });
    },
    showOpenDialog: () => {
        ipcRenderer.send("show-open-dialog");
    },
    showExportHtmlDialog: (html: string) => {
        ipcRenderer.send("show-export-html-dialog", html);
    },
    saveFile: async (content: string) => {
        ipcRenderer.send("save-file", content);
    },
    checkForUnsavedChanges: async (content: string) => {
        const result = ipcRenderer.invoke("has-changed", content);
        return result;
    },
    showInFolder: async () => {
        ipcRenderer.send("show-in-file-system");
    },
    openInDefault: async () => {
        ipcRenderer.send("open-in-default");
    },
});
