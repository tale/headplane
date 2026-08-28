{{/*
Generate a random cookie secret if none is provided
*/}}
{{- define "headplane.cookieSecret" -}}
{{- if and .Values.headplane.secret .Values.headplane.secret.server (hasKey .Values.headplane.secret.server "cookie_secret") .Values.headplane.secret.server.cookie_secret -}}
{{- .Values.headplane.secret.server.cookie_secret -}}
{{- else -}}
{{- randAlphaNum 32 -}}
{{- end -}}
{{- end -}} 