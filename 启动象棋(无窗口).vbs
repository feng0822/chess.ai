Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ws.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
ws.Run "pythonw app.py", 0, False
WScript.Sleep 2500
ws.Run "http://127.0.0.1:5000", 1, False
