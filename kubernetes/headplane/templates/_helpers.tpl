{{- define "headplane.cookieSecret" -}}
{{- if .Values.headplane.config.cookieSecret.value -}}
{{- .Values.headplane.config.cookieSecret.value -}}
{{- else -}}
{{- randAlphaNum 32 -}}
{{- end -}}
{{- end -}}
