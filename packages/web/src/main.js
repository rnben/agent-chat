import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";
// hljs 浅色主题（默认），深色主题在 style.css 的 .dark 块中覆盖
import "highlight.js/styles/github.css";

createApp(App).mount("#app");
