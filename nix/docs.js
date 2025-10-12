import fs from "node:fs";

function renderOptions(options) {
	const blocks = Object.keys(options).map((key) => {
		const opt = options[key];
		const name = key.split(".").slice(2).join(".");
		const lines = [];
		lines.push(`## ${name}`);
		lines.push(`*Description:* ${opt.description}\n`);
		lines.push(`*Type:* ${opt.type}\n`);
		if (opt.default) {
			lines.push(`*Default:* \`${opt.default.text}\`\n`);
		}
		if (opt.example) {
			lines.push(`*Example:* \`${opt.example.text}\`\n`);
		}
		return lines.join("\n");
	});

	return [
		`# NixOS module options
		 |
		 |All options must be under \`services.headplane\`.
		 |
     |For example: \`settings.headscale.config_path\` becomes \`services.headplane.settings.headscale.config_path\`.`
			.split("|")
			.map((s) => s.replace(/\n\s+/g, ""))
			.join("\n"),
	]
		.concat(blocks)
		.join("\n\n");
}

const filename = process.argv[2];
const file = fs.readFileSync(filename);
const json = JSON.parse(file);
console.log(renderOptions(json));
