import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '@blueprintjs/core';
import './FileSelector.scss';
const { remote } = window.require('electron');
const { dialog } = remote;

const FileSelector = ({
  save = false,
  buttonText = 'Select',
  buttonIcon,
  disabled = false,
  file,
  options,
  onFileSelected,
}) => {
  const selectFile = async () => {
    const show = save ? dialog.showSaveDialog : dialog.showOpenDialog;
    const result = await show(options);
    const file = result.filePath || (result.filePaths && result.filePaths.length === 1 ? result.filePaths[0] : '');
    if (file) {
      onFileSelected(file);
    }
  };
  return (
    <div className="file-selector">
      <div className="file-selector__button">
        <Button text={buttonText} icon={buttonIcon} onClick={selectFile} disabled={disabled} />
      </div>
      <div className="file-selector__filename">{file}</div>
    </div>
  );
};

FileSelector.propTypes = {
  save: PropTypes.bool,
  buttonText: PropTypes.string,
  buttonIcon: PropTypes.object,
  disabled: PropTypes.bool,
  file: PropTypes.string,
  options: PropTypes.object,
  onFileSelected: PropTypes.func,
};

FileSelector.defaultProps = {};

export default FileSelector;
