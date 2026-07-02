{{/*
Chart name, truncated to 63 chars.
*/}}
{{- define "headplane.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fully qualified app name. Uses release name + chart name unless overridden.
*/}}
{{- define "headplane.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label value.
*/}}
{{- define "headplane.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Standard metadata labels applied to every resource.
*/}}
{{- define "headplane.labels" -}}
helm.sh/chart: {{ include "headplane.chart" . }}
{{ include "headplane.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels used for pod matching in Services and Deployments.
*/}}
{{- define "headplane.selectorLabels" -}}
app.kubernetes.io/name: {{ include "headplane.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
ServiceAccount name. Uses the fullname if creation is enabled, otherwise
falls back to a user-provided name or the default SA.
*/}}
{{- define "headplane.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "headplane.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate a random cookie secret if one is not provided.
*/}}
{{- define "headplane.cookieSecret" -}}
{{- if .Values.server.cookieSecret.value -}}
{{- .Values.server.cookieSecret.value -}}
{{- else -}}
{{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}
