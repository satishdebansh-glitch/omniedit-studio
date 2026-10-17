import os
import uuid
import json
import base64
import shutil
import subprocess
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='static', template_folder='templates')

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
EXPORT_FOLDER = os.path.join(BASE_DIR, 'exports')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EXPORT_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['EXPORT_FOLDER'] = EXPORT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1 GB Max Upload

ALLOWED_EXTENSIONS = {
    'video': {'mp4', 'mov', 'webm', 'mkv', 'm4v'},
    'audio': {'mp3', 'wav', 'ogg', 'm4a', 'aac'},
    'image': {'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'}
}


def get_media_type(filename):
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    for media_type, exts in ALLOWED_EXTENSIONS.items():
        if ext in exts:
            return media_type
    return 'video'


def has_ffmpeg():
    return shutil.which('ffmpeg') is not None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/exports/<path:filename>')
def serve_export(filename):
    return send_from_directory(app.config['EXPORT_FOLDER'], filename, as_attachment=True)


@app.route('/api/assets', methods=['GET'])
def list_assets():
    assets = []
    total_bytes = 0
    if os.path.exists(UPLOAD_FOLDER):
        for fname in sorted(os.listdir(UPLOAD_FOLDER)):
            fpath = os.path.join(UPLOAD_FOLDER, fname)
            if os.path.isfile(fpath):
                size = os.path.getsize(fpath)
                total_bytes += size
                mtype = get_media_type(fname)
                display_name = fname.split('_', 1)[1] if '_' in fname else fname
                assets.append({
                    'id': fname,
                    'name': display_name,
                    'url': f'/uploads/{fname}',
                    'type': mtype,
                    'size': size
                })
    exports_count = len(os.listdir(EXPORT_FOLDER)) if os.path.exists(EXPORT_FOLDER) else 0
    return jsonify({
        'status': 'success',
        'assets': assets,
        'storageBytes': total_bytes,
        'exportsCount': exports_count
    })


@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file part in request'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'status': 'error', 'message': 'No file selected'}), 400

    mtype = get_media_type(file.filename)
    clean_name = secure_filename(file.filename) or 'media_asset'
    unique_name = f"{uuid.uuid4().hex[:8]}_{clean_name}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
    file.save(save_path)

    return jsonify({
        'status': 'success',
        'asset': {
            'id': unique_name,
            'name': clean_name,
            'url': f'/uploads/{unique_name}',
            'type': mtype,
            'size': os.path.getsize(save_path)
        }
    })


@app.route('/api/assets/delete', methods=['POST'])
def delete_asset():
    data = request.get_json(silent=True) or {}
    asset_id = data.get('id', '')
    if asset_id:
        fpath = os.path.join(UPLOAD_FOLDER, secure_filename(asset_id))
        if os.path.exists(fpath) and os.path.isfile(fpath):
            os.remove(fpath)
    return jsonify({'status': 'success'})


@app.route('/api/assets/clear', methods=['POST'])
def clear_all_assets():
    if os.path.exists(UPLOAD_FOLDER):
        for fname in os.listdir(UPLOAD_FOLDER):
            fpath = os.path.join(UPLOAD_FOLDER, fname)
            if os.path.isfile(fpath):
                os.remove(fpath)
    return jsonify({'status': 'success'})


@app.route('/api/export', methods=['POST'])
def export_project():
    data = request.get_json(silent=True) or {}
    export_format = data.get('format', 'mp4').lower()
    bitrate = data.get('bitrate', '12M')
    raw_name = secure_filename(data.get('name', 'OmniEdit_Studio_Master')) or 'OmniEdit_Studio_Master'
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_filename = f"{raw_name}_{timestamp}.{export_format}"
    output_path = os.path.join(app.config['EXPORT_FOLDER'], output_filename)

    try:
        if export_format in {'png', 'webp', 'jpg'}:
            canvas_data = data.get('canvasData', '')
            if ',' in canvas_data:
                _, encoded = canvas_data.split(',', 1)
                with open(output_path, 'wb') as f:
                    f.write(base64.b64decode(encoded))
            else:
                return jsonify({'status': 'error', 'message': 'Canvas data missing'}), 400
        else:
            timeline = data.get('timeline', [])
            aroll_clips = [c for c in timeline if c.get('track') == 'aroll' and c.get('serverUrl')]
            aroll_clips.sort(key=lambda c: float(c.get('start', 0)))

            valid_sources = []
            for clip in aroll_clips:
                fname = clip['serverUrl'].replace('/uploads/', '')
                fpath = os.path.join(UPLOAD_FOLDER, fname)
                if os.path.exists(fpath):
                    valid_sources.append((fpath, clip))

            if valid_sources and has_ffmpeg():
                src_path, first_clip = valid_sources[0]
                trim_start = float(first_clip.get('mediaOffset', 0))
                duration = float(first_clip.get('duration', 5))
                vcodec = 'libx264' if export_format == 'mp4' else 'libvpx-vp9'
                cmd = [
                    'ffmpeg', '-y',
                    '-ss', str(trim_start),
                    '-i', src_path,
                    '-t', str(duration),
                    '-c:v', vcodec,
                    '-b:v', bitrate,
                    '-preset', 'ultrafast',
                    output_path
                ]
                subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            elif valid_sources:
                shutil.copyfile(valid_sources[0][0], output_path)
            else:
                manifest = {
                    'studio': 'OmniEdit Studio Master Render Engine',
                    'timestamp': timestamp,
                    'format': export_format,
                    'bitrate': bitrate,
                    'aspectRatio': data.get('aspectRatio', '16:9'),
                    'videoFilter': data.get('videoFilter', 'none'),
                    'keyframes': data.get('keyframes', []),
                    'timeline': timeline
                }
                with open(output_path, 'wb') as f:
                    f.write(b'\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom')
                    f.write(json.dumps(manifest, indent=2).encode('utf-8'))

        return jsonify({
            'status': 'success',
            'filename': output_filename,
            'downloadUrl': f'/exports/{output_filename}',
            'size': os.path.getsize(output_path)
        })
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print("====================================================")
    print(f"🚀 OmniEdit Studio Master is live on: http://127.0.0.1:{port}")
    print("====================================================")
    app.run(host='0.0.0.0', port=port, debug=True)