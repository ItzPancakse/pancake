// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn window_backend() -> String {
    match std::env::var("GDK_BACKEND").as_deref() {
        Ok("x11") => "x11".into(),
        Ok("wayland") => "wayland".into(),
        _ => std::env::var("XDG_SESSION_TYPE").unwrap_or_default(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    // We need to force x11 cause wayland breaks window positioning
    {
        // Wayland windows cant position themselves or say stay on top XWayland can so we are forcing x11
        if std::env::var_os("GDK_BACKEND").is_none() {
             unsafe {
                 std::env::set_var("GDK_BACKEND", "x11");
             }
            // Fixes blank/black windows on many nvidia + webkitgtk setups
            if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()  {
                unsafe {
                    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
                }
            }
        }

        tauri::Builder::default()
            .plugin(tauri_plugin_os::init())
            .invoke_handler(tauri::generate_handler![window_backend])
            .setup(|app| {
                #[cfg(debug_assertions)]
                {
                    use tauri::Manager;
                    if let Some(w) = app.get_webview_window("main") {
                        w.open_devtools();
                    }
                }
                Ok(())
            })
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}