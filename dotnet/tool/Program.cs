using System.CommandLine;
using SweDevTools.LiveDoc.Tool.Commands;

var rootCommand = new RootCommand("LiveDoc CLI — AI-powered living documentation tools");
rootCommand.AddCommand(InstallSkillCommand.Create());

return await rootCommand.InvokeAsync(args);
