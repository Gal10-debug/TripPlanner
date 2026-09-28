"""Fail CI on advisories; dotnet list package itself exits zero when advisories exist."""
import json
import subprocess
import sys

result = subprocess.run(['dotnet', 'list', 'TripPlanner.slnx', 'package', '--vulnerable', '--include-transitive', '--format', 'json'], capture_output=True, text=True)
if result.returncode:
    sys.stderr.write(result.stderr)
    sys.exit(result.returncode)
data = json.loads(result.stdout)
if data.get('problems') or not data.get('projects'):
    sys.exit('NuGet audit did not return a complete project report')
findings = []
for project in data['projects']:
    for framework in project.get('frameworks', []):
        for package in framework.get('topLevelPackages', []) + framework.get('transitivePackages', []):
            for vulnerability in package.get('vulnerabilities', []):
                findings.append(f"{package['id']} {package.get('resolvedVersion', '')}: {vulnerability.get('severity')} {vulnerability.get('advisoryurl', '')}")
if findings:
    sys.exit('\n'.join(findings))
print('NuGet audit: no known vulnerabilities in any project.')
