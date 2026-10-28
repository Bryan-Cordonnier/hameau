import "@etabli/sdk/base.css";
import "@etabli/ui/kit.css";
import "@hameau/commun/agl.css";
import { mount } from "svelte";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });
