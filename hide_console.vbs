Set objShell = CreateObject("WScript.Shell")
Set objWshScriptExec = objShell.Exec("powershell -Command ""Add-Type -Name Win32 -MemberDefinition '[DllImport(\"\"user32.dll\"\")][return: MarshalAs(UnmanagedType.Bool)]public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);[DllImport(\"\"kernel32.dll\"\")]public static extern IntPtr GetConsoleWindow();'; $hWnd = [Win32]::GetConsoleWindow(); [Win32]::ShowWindow($hWnd, 0);""")
Do While Not objWshScriptExec.StdOut.AtEndOfStream
    objWshScriptExec.StdOut.ReadLine()
Loop
