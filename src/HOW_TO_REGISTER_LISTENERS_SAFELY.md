### Register listeners safely

```ts
this.registerEvent(this.app.workspace.on("file-open", f => { /* ... */
}));
this.registerDomEvent(window, "resize", () => { /* ... */
});
this.registerInterval(window.setInterval(() => { /* ... */
}, 1000));
```
